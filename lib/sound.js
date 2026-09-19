// Synthesized sound effects via Web Audio API — no files to load, tiny, instant.
// Respects a persisted mute setting (on by default) and the browser autoplay
// policy (audio only after first user gesture, which all our triggers satisfy).

let ctx = null;
let enabled = true;
let loaded = false;

function load() {
  if (loaded) return;
  loaded = true;
  try {
    const v = localStorage.getItem('reclipse-sound');
    enabled = v === null ? true : v === 'on';
  } catch { enabled = true; }
}

export function soundEnabled() { load(); return enabled; }
export function setSound(on) {
  load(); enabled = on;
  try { localStorage.setItem('reclipse-sound', on ? 'on' : 'off'); } catch {}
}

function ac() {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

// One tone with an envelope.
function tone(freq, { type = 'sine', dur = 0.12, gain = 0.14, attack = 0.005, decay, when = 0 } = {}) {
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime + when;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  const d = decay ?? dur;
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
  osc.connect(g); g.connect(c.destination);
  osc.start(t0); osc.stop(t0 + d + 0.02);
}

// A quick upward glide (for wins).
function sweep(f1, f2, { type = 'sine', dur = 0.18, gain = 0.13 } = {}) {
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(f1, t0);
  osc.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g); g.connect(c.destination);
  osc.start(t0); osc.stop(t0 + dur + 0.02);
}

// Named effects — each keyed to a real interaction.
const SFX = {
  flip:    () => tone(340, { type: 'triangle', dur: 0.09, gain: 0.08 }),
  tap:     () => tone(520, { type: 'sine', dur: 0.06, gain: 0.06 }),
  correct: () => { tone(660, { type: 'sine', dur: 0.1, gain: 0.12 }); tone(880, { type: 'sine', dur: 0.14, gain: 0.11, when: 0.09 }); },
  wrong:   () => tone(180, { type: 'sine', dur: 0.18, gain: 0.1 }),
  next:    () => tone(600, { type: 'triangle', dur: 0.07, gain: 0.07 }),
  levelup: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, { type: 'triangle', dur: 0.16, gain: 0.12, when: i * 0.08 })); },
  complete:() => { sweep(440, 880, { type: 'sine', dur: 0.22, gain: 0.13 }); tone(1175, { type: 'sine', dur: 0.2, gain: 0.1, when: 0.18 }); },
  achieve: () => { tone(784, { type: 'triangle', dur: 0.12, gain: 0.12 }); tone(1047, { type: 'triangle', dur: 0.18, gain: 0.11, when: 0.1 }); },
};

export function play(name) {
  load();
  if (!enabled) return;
  const fn = SFX[name];
  if (fn) try { fn(); } catch {}
}
