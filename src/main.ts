import * as THREE from 'three/webgpu';
import { CONFIG } from './config';
import { createRenderer } from './core/createRenderer';
import { createUniforms } from './core/Uniforms';
import { Loop } from './core/Loop';
import { ParticleField } from './particles/ParticleField';
import { CompositeInput } from './input/CompositeInput';
import { KeyboardInput } from './input/KeyboardInput';
import { GamepadInput } from './input/GamepadInput';
import { createFlightState, stepFlight } from './flight/Flight';
import { FlightRig } from './flight/FlightRig';
import { Director } from './tutorial/Director';
import { MODE_ORDER } from './guidance/registry';
import { readUrlParams } from './dev/urlParams';
import { DevPanel } from './dev/DevPanel';
import { BEATS } from './tutorial/beats';

const opts = readUrlParams();

const { renderer } = await createRenderer(document.body);
const uniforms = createUniforms();

const scene = new THREE.Scene();
const field = new ParticleField(renderer, uniforms, opts.count ?? CONFIG.particles.count);
await field.init();
scene.add(field.object);

const rig = new FlightRig();
rig.resize(window.innerWidth, window.innerHeight);

const flight = createFlightState();
const input = new CompositeInput([new KeyboardInput(), new GamepadInput()]);
input.connect();

const director = new Director(field, uniforms, flight, opts.mode);

// Einzelnen Beat isolieren: ?beat=rechts
if (opts.beat) {
  const i = BEATS.findIndex((b) => b.id === opts.beat);
  if (i > 0) {
    BEATS.splice(0, i);
    flight.forwardSpeed = CONFIG.flight.cruiseSpeed;
    uniforms.fieldDensity.value = 1;
  }
}
director.start();

const panel = opts.dev ? new DevPanel(uniforms, director) : null;

// --- Tasten: Modus mit Neustart waehlen, Fortschritt von Hand --------------
let manualProgress = false;
window.addEventListener('keydown', (e) => {
  const n = Number(e.key);
  if (n >= 1 && n <= MODE_ORDER.length) {
    const id = MODE_ORDER[n - 1];
    if (id !== director.currentModeId && !e.repeat) {
      const url = new URL(window.location.href);
      url.searchParams.set('mode', id);
      url.searchParams.delete('beat');
      url.searchParams.delete('freeze');
      window.location.replace(url);
    }
  }
  if (e.code === 'KeyP') manualProgress = !manualProgress;
});

/**
 * Groesse pro Frame pruefen statt nur auf das resize-Event zu hoerchen.
 * Wird die Seite unsichtbar oder in einem 0x0-Container geladen, meldet das
 * Event nie etwas und das Canvas bliebe fuer immer leer.
 */
let lastW = 0;
let lastH = 0;
function syncSize() {
  const w = Math.max(1, window.innerWidth);
  const h = Math.max(1, window.innerHeight);
  if (w === lastW && h === lastH) return;
  lastW = w;
  lastH = h;
  renderer.setSize(w, h);
  rig.resize(w, h);
}

const loop = new Loop((dt) => {
  syncSize();

  const cmd = input.read(dt);
  stepFlight(flight, cmd, dt);

  if (!opts.freeze && !manualProgress) {
    director.update(dt);
  }
  // Laeuft immer: die Formation altert auch im Standbild-Modus weiter, damit
  // sich die Versammlung der Partikel fertig aufbauen kann.
  uniforms.formationAge.value += dt;

  uniforms.flyerPos.value.copy(flight.position);
  field.decayBurst(dt);
  field.update();

  rig.sync(flight);
  renderer.render(scene, rig.camera);

  panel?.update(loop.fps);
});
loop.start();

// Dev-Zugriff fuer Messungen von aussen (nur mit ?dev=1).
if (opts.dev) {
  const debugApi = {
    flight, director, uniforms, field, loop, opts,
  };
  const globals = window as unknown as Record<string, unknown>;
  globals.__becomingManyTutorial = debugApi;
  globals.__weiss1 = debugApi;
}

console.info('[Becoming Many Tutorial] bereit - WASD fliegen, 1-2 Modus wechseln.');
