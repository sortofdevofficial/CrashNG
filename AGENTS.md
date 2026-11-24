# AGENTS.md — CrashNG

Browser-only Three.js crash sandbox. No build step, no package manager, no tests runner.
Everything is **classic scripts** loaded in order by `index.html`, sharing one global scope.

## Run it

- Open `index.html` directly in a desktop browser (needs internet for the Three.js r149 CDN).
- Or serve the folder: `python -m http.server 8000` → `http://localhost:8000/`.
- Controls: walk with WASD, `E` enter/exit the nearest vehicle, `R` respawn, `W/S` throttle/reverse,
  `A/D` steer, `Space` handbrake, `Shift` nitro, `H` horn, `L` lights, `X` hazards, `N` day/night.

## File map (load order matters — top to bottom is dependency order)

| File | Owns | Depends on |
| --- | --- | --- |
| `js/world.js` | Quality tier `Q`, neon gates + boost `PADS`, `SUNOFF`, `scene/camera/renderer`, sun/sky, runway constants `RX RW RL RH RZ LZ0 SL`, `gh(x,z)` terrain height, walkable character (`root`) + contact shadow | Three CDN |
| `js/materials.js` | Shared canvas textures + PBR materials, `carG` root group, `detachParts`/`detachable()`, `cm() splinePts() loftGeo()` | world |
| `js/cars-lambo.js` | Lambo shell (`BODY` loft, glass, interior, engine bay), `carBody`, exhaust flames | materials |
| `js/vehicles.js` | Shared wheels (`wheels[]`, `WHEEL_LAYOUT`, `setWheels`), `CHIRON_PHYS`/`chironBits`, `TRUCK_PHYS`/`truckBody`, `FERRARI_PHYS`/`f1Body`, `SKINS` registry | materials/cars-lambo |
| `js/core.js` | `PHYS`/`LAMBO_PHYS`, live `car`/`crash`/`wheelDmg`, HUD refs, `clamp wrap torqueAt tireCurve carLocalP zoneHit`, smoke + skid pools; then replay (`REC RP REPCAM`, `recordFrame updateReplay startReplay endReplay`) | vehicles |
| `js/damage.js` | Panel cut-up (doors, fenders, quarters, hood, nose, cover, bumper), underfloor parts, `PARTS`, **`SOFT` + `dentAt()` BeamNG-style crush**, `crashSag()`, `detachPart() spawnShards() spawnSparks() impactAt() updateDebris() repairBody() repairParts()` | core |
| `js/obstacles.js` | `OB` props (cones, drums, crates, hay, pins, signs, big crates; scaled to `RL`/`SL`), `resetObstacles updateObstacles`, `collideParked()`, boost pads `updatePads()` | core/damage |
| `js/physics.js` | `updateCar(dt)`: gearbox, tire friction circle, suspension, poses, barrier + corner impacts | core/damage |
| `js/electrics.js` | WebAudio (`AUD audioInit audioUpdate audioThud audioClank hornBtn`), then lights/signals and day/sunset/night (`lights setTime updateAuto`) and the L/K/Z/C/X/N/M keys | core/damage |
| `js/main.js` | `resetCar setCar applySkin makeParked layoutCars swapTo toggleCar respawnCar`, buttons/keys, walker camera, `frame()`, boot | all above |

If you add a file, insert its `<script>` in `index.html` **after** everything it reads at load time.

## Hard rules

- **No modules, no bundler.** Top-level `const`/`let` are global and shared across files. Duplicate a
  top-level name anywhere and the whole page dies — check with the syntax command below.
- **Load order is behavioural.** Top-level code (not just functions) runs per file; a file may only
  read names already initialised above it.
- **Units are SI** (m, kg, N, m/s). Heading is `car.h` with `carG.rotation.y = car.h`; local **+Z is
  forward**, **+X is right**, **+Y is up**. Terrain is `gh(x,z)` and returns `-1e4` for the void.
- Keep the cockpit-only HUD (`#aux`, `#speed`, `#gear` only while seated) and the no-build layout.
- Do not leave scratch/harness/screenshot files in the repo when done.

## Vehicle model

- A vehicle = one `SKINS` entry + one `*_PHYS` constant + one body group + `WHEEL_LAYOUT` row.
- `applySkin(k)` merges tuning with `Object.assign(PHYS, LAMBO_PHYS, k==='truck'?TRUCK_PHYS:...)`,
  toggles `carBody/truckBody/f1Body`, calls `setWheels(k)`, recolours `paint`/`caliperM`, hides
  headlights on the F1.
- All driveable vehicles share `wheels[]`; `setWheels` only moves/scales them.
- Detachable parts are registered by `detachable(...)` in `materials.js`. Deformable meshes are listed in `SOFT` (damage.js): the Lambo/Chiron shell, truck cab/chassis boxes (auto-subdivided) and the F1 hull/pods. Parts created by a specific
  vehicle set `d.skin` so they can only fly off while that skin is active.
- Parked vehicles are clones in `parked[k]` (own geometry + paint). They carry
  `userData.skin/pv/pr/hitCool` used by `collideParked()`.

### Add a vehicle (checklist)

1. Add `XXX_PHYS` in a new `js/cars-xxx.js` (copy a similar `*_PHYS`; include `mass`, `izz`,
   `gears`, `halfW`, `halfL`, `zoneF/zoneR/zoneX`, `eyeY`, `audioMul`, `lpBase`).
2. Build its body group (`xxxBody`) from shared materials in `materials.js`.
3. Add the `SKINS` entry (name/paint/caliper/bits/slotX).
4. Add `WHEEL_LAYOUT.xxx` and extend the `setWheels` call site in `applySkin`.
5. Add the body toggle in `applySkin` and the lean line in `updateCar` (`xxxBody.rotation/position.y`).
6. Add `SKIN_HALF`/`SKIN_MASS` rows in `obstacles.js` so parked copies collide correctly.
7. Add the `<script>` to `index.html` before `skins.js`.

## Crash pipeline (how damage happens)

```
collision source ──► impactAt(wx,wy,wz, nx,ny,nz, strength, mass)
                     ├─ crash.dmg / crash.shake / crash.flash / slow-mo
                     ├─ dentAt()        soft-body crush: SOFT meshes pushed along the hit, noisy, hood folds up, sides pinch
                     ├─ carLocalP/zoneHit + detachParts  → detachPart() (bolts loosen by `d.acc`)
                     ├─ wheelDmg[]      bent / ripped-off wheels
                     ├─ puff + spawnSparks + debris + audioThud/audioClank
                     └─ REC.ev          replay event stream (dents, detaches)
```

Sources of impacts: props (`updateObstacles`), parked vehicles (`collideParked`), side barriers and
front-corner probes (`updateCar`), jump landings (`updateCar`), replay playback (`applyReplayEvent`).

Damage zones per part: `front`, `rear`, `left`, `right`, or none (any hit), gated by `zoneHit()` and
`d.thresh`. Heavy vehicles use the same code but `PHYS.mass` makes `tough` reduce damage.

## Verify a change

1. Syntax + duplicate-global check (concatenate exactly like the browser loads):
   ```bash
   node -e "const fs=require('fs'),s=fs.readFileSync('index.html','utf8');const f=[...s.matchAll(/<script src=\"(js\/[^\"]+)\"/g)].map(m=>m[1]);fs.writeFileSync('.concat.js',f.map(x=>fs.readFileSync(x,'utf8')).join('\n'))"
   node --check .concat.js && rm .concat.js
   ```
2. Runtime smoke test in headless Chrome (uses the real scripts, stubs RAF, drives `updateCar`):
   copy `index.html` to `.check.html`, add `<script>window.requestAnimationFrame=()=>1</script>`
   before the CDN tag, append a script that calls `updateCar(1/60)` N times and writes JSON into a
   `<pre id="res">`, then:
   ```bash
   chrome --headless=new --disable-gpu --no-sandbox --allow-file-access-from-files \
     --virtual-time-budget=15000 --dump-dom "file:///.../.check.html"
   ```
   Assert `errs: []`, four skins apply, speed climbs, `impactAt(...)` raises `crash.dmg` and detaches
   parts. Delete `.check.html` afterwards.
3. Open `index.html`, enter a car, drive into the truck/barrier/props and confirm the HUD, damage,
   replay and audio still behave.

## Performance & devices

- `Q` (world.js) picks a tier at load: low on phones / <=4 cores / <=4 GB, high otherwise. The **Graphics** button cycles
  Auto -> Low -> High (stored in `localStorage['cng-q']`, then reloads). Low = 1024 shadows, no AA, fewer clouds/smoke/skids.
- `frame()` (main.js) does dynamic resolution: it lowers/raises the renderer pixel ratio (0.5/0.6 .. `Q.pr`) to hold ~50 fps and
  only turns shadows off if it is still under 28 fps at the lowest resolution.
- Parked copies (`makeParked`) share GPU buffers with the live car except deformable meshes (`SOFT`) and the shell panels.
- Sleeping obstacles more than 400 m from the camera are hidden and skipped (`updateObstacles`).
- Touch devices (`Q.touch`) get an on-screen pad (writes into `keys`) and one-finger drag-to-look; keyboard play is unchanged.

## Crash realism extras (damage.js)

- Parts hang before they fall: once a part passes ~45% of its tear-off load it gets `d.loose` and `updateLoose()` sags/rattles it.
- Extra parts: crash beams (need nose/bumper gone first), wipers, antenna, tow hooks, control arms (snap when a wheel is wrecked), fenders, quarters, driveshaft, fuel cell (fire).
- `spawnGlass()` on window/windscreen loss; `crashFX()` adds steam (no radiator) and oil/coolant/fuel puddles; every hit sheds ~0.35% speed per strength point (energy absorbed by crush).

## Ramp areas + terrain (world.js, obstacles.js)

- The ramp is 1800 m long, 26 m wide, split into 3 areas of `AL` = 600 m: **hills** (normal asphalt through hilly terrain), **frozen road** (ice, `SURF.mu` 0.05, snow), **city** (asphalt, towers with lit windows, street lamps, ~12 traffic cars).
- Traffic: `TRAF` cars drive down the city stretch (`updateTraffic`); `hitTraffic` pushes the player out, shoves/brakes the traffic car and calls `impactAt()`.
- Terrain: `TER` heightmap + hills/biome colours + instanced scenery; `gh()` falls back to `terrainH()` off the road. Lane lines are instanced; no boost pads/neon gates/weapons any more (realism).

### Ramp sections (older notes)

- `ZONES` splits the ramp into stretches (asphalt, ice, hammers, lava chicane, sand, oil, conveyor, bounce pads, blades, ice finale); `surfAt(x,z)` says what the tyres are on and `overlay` meshes colour each one.
- `updateSurface()` (called at the top of `updateCar`) fills `SURF`: ice mu 0.1, oil 0.3, sand drag, lava burns (damage + engine fire), conveyor side push, bounce pads launch the car.
- `SPIN` = rotating hammers/blades on posts tilted with the ramp; `updateSpinners()` tests arm points against the car box and calls `impactAt()` with the point velocity (omega x r).

## Visual + performance extras (latest pass)

- world.js: distant `mountains` ring + `sunFlare` sprite follow the camera; terrain has a detail texture; the canvas gets a CSS colour grade on high quality; ramp overlays are distance-culled (`cullZones`).
- electrics.js `updateWeather()`: rain / snow / dust / embers / neon motes per area (one `Points`, 1100 particles, 350 on low).
- main.js: every 8 frames parked copies, spinners and overlays far from the camera are hidden (the biggest draw-call saver).
- damage.js: passenger cell is stiffer than the crumple zones, crush cap 1.9 m, strength cap 55, loose hood peels up / doors swing open at speed; physics.js: bent wheels pull the car to one side.

## Latest pass: rollover, fire, glow

- damage.js: `FLIP` rollover (`startFlip/updateFlip`, roof dent via `impactAt(..., ny=-1)`), `crashBurn/explodeCar` (an engine fire that burns ~9 s detonates and throws parts). Triggers live in obstacles.js (`updateSurface` sideways-speed check, blade slams).
- electrics.js `updateGlow()`: headlight/taillight halos, night moon, per-area fog tint (`FOGB` is the time-of-day base colour).
- main.js: the resolution scaler now shrinks the shadow map before it disables shadows; `P` shows fps / resolution / draw calls.

## Realism pass

- Traffic (`obstacles.js`): cars keep a following distance (to each other and to the player), brake with lit tail lights, and a hard hit turns one into a wreck (spins, crumples, hazards blinking, stays stopped until it loops/respawns).
- Brakes (`physics.js`): `car.bt` heat from pressure x speed, fade up to -60% and glowing discs; message tells you to use engine braking.
- Engine (`damage.js` `crashFX`): `car.et` temperature; no radiator -> overheats, cooks the engine past 140 C and seizes it.
- Audio: wind noise rises with speed. World: speed-limit signs along the ramp.
