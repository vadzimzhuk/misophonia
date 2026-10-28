// Most sounds are synthesized live with the Web Audio API; a few are recorded files in /sounds.

let ctx = null;
let master = null;
let muted = false;
const VOLUME = 0.8;

/** Lazily create / resume the AudioContext. Must be called from a user gesture. */
export function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : VOLUME;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp);
    comp.connect(ctx.destination);
    // Fetch + decode recorded sounds up front so they play instantly when picked.
    for (const s of [...SOUNDS, BONUS]) if (s.url) loadBuffer(s.url).catch(() => {});
  }
  if (ctx.state === 'suspended') ctx.resume();
  return { ctx, out: master };
}

export function setMuted(value) {
  muted = value;
  if (master) master.gain.setTargetAtTime(muted ? 0 : VOLUME, ctx.currentTime, 0.02);
}

export function isMuted() {
  return muted;
}

// ---------------------------------------------------------------- helpers

function envelope(c, dest, t, { attack = 0.005, hold = 0, release = 0.2, peak = 0.3 } = {}) {
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.setValueAtTime(peak, t + attack + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);
  g.connect(dest);
  return g;
}

function tone(c, dest, { type = 'sine', freq = 440, freqEnd, t, attack = 0.005, hold = 0, release = 0.2, peak = 0.3 }) {
  const o = c.createOscillator();
  const end = t + attack + hold + release;
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, end);
  o.connect(envelope(c, dest, t, { attack, hold, release, peak }));
  o.start(t);
  o.stop(end + 0.05);
  return o;
}

let noiseBuffer = null;
function noise(c) {
  if (!noiseBuffer) {
    const len = c.sampleRate * 2;
    noiseBuffer = c.createBuffer(1, len, c.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }
  const src = c.createBufferSource();
  src.buffer = noiseBuffer;
  src.loop = true;
  return src;
}

function filter(c, type, freq, Q = 1) {
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = Q;
  return f;
}

function gain(c, value, dest) {
  const g = c.createGain();
  g.gain.value = value;
  if (dest) g.connect(dest);
  return g;
}

function lfo(c, target, rate, depth, t, dur) {
  const o = c.createOscillator();
  o.frequency.value = rate;
  o.connect(gain(c, depth, target));
  o.start(t);
  o.stop(t + dur);
  return o;
}

function panner(c, dest) {
  if (c.createStereoPanner) {
    const p = c.createStereoPanner();
    p.connect(dest);
    return p;
  }
  return null;
}

const now = (c) => c.currentTime + 0.02;

// ---------------------------------------------------------------- recorded files

const buffers = new Map(); // url -> Promise<AudioBuffer>

function loadBuffer(url) {
  if (!buffers.has(url)) {
    const { ctx: c } = audio();
    const loading = fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
        return res.arrayBuffer();
      })
      .then((data) => c.decodeAudioData(data))
      .catch((err) => {
        buffers.delete(url); // allow a retry on the next pick
        throw err;
      });
    buffers.set(url, loading);
  }
  return buffers.get(url);
}

/** Sound entry fields for a recorded file: `{ ...fromFile('sounds/x.mp3') }`. */
function fromFile(url, volume = 1) {
  return {
    url,
    async play() {
      try {
        const { ctx: c, out } = audio();
        const src = c.createBufferSource();
        src.buffer = await loadBuffer(url);
        src.connect(gain(c, volume, out));
        src.start();
      } catch (err) {
        console.warn('Could not play sound file', err);
      }
    },
  };
}

// ---------------------------------------------------------------- the library

function teamsCall(c, out) {
  const t = now(c);
  const notes = [523, 659, 784, 659, 880, 784];
  for (let rep = 0; rep < 2; rep++) {
    notes.forEach((f, i) => {
      const s = t + rep * 1.1 + i * 0.11;
      tone(c, out, { type: 'triangle', freq: f, t: s, release: 0.22, peak: 0.25 });
      tone(c, out, { freq: f * 2, t: s, release: 0.1, peak: 0.04 });
    });
  }
}

function alarm(c, out) {
  const t = now(c);
  for (let g = 0; g < 3; g++) {
    for (let b = 0; b < 4; b++) {
      tone(c, out, { type: 'square', freq: 1050, t: t + g * 0.75 + b * 0.12, attack: 0.002, hold: 0.06, release: 0.02, peak: 0.12 });
    }
  }
}

function forkOnPlate(c, out) {
  const t = now(c);
  const dur = 1.6;
  const g = c.createGain();
  g.gain.value = 0.0001;
  g.connect(out);
  [[0, 0.45], [0.55, 0.35], [1.0, 0.6]].forEach(([s, d]) => {
    g.gain.setValueAtTime(0.0001, t + s);
    g.gain.exponentialRampToValueAtTime(0.25, t + s + 0.05);
    g.gain.setValueAtTime(0.25, t + s + d - 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, t + s + d);
  });
  [2800, 3500, 4300].forEach((f, i) => {
    const o = c.createOscillator();
    o.frequency.setValueAtTime(f, t);
    o.frequency.linearRampToValueAtTime(f * 1.15, t + 0.45);
    o.frequency.linearRampToValueAtTime(f * 0.95, t + 0.9);
    o.frequency.linearRampToValueAtTime(f * 1.25, t + dur);
    lfo(c, o.frequency, 7 + i * 2.3, f * 0.03, t, dur + 0.1);
    o.connect(gain(c, [0.5, 0.3, 0.2][i], g));
    o.start(t);
    o.stop(t + dur + 0.1);
  });
  const n = noise(c);
  const bp = filter(c, 'bandpass', 5000, 3);
  n.connect(bp);
  bp.connect(gain(c, 0.25, g));
  n.start(t);
  n.stop(t + dur + 0.1);
}

function phoneVibrate(c, out) {
  const t = now(c);
  const dur = 2.5;
  const lp = filter(c, 'lowpass', 650, 2);
  const g = gain(c, 0.0001, out);
  lp.connect(g);
  const o = c.createOscillator();
  o.type = 'sawtooth';
  o.frequency.value = 165;
  const rattle = c.createOscillator();
  rattle.type = 'square';
  rattle.frequency.value = 82;
  const trem = gain(c, 0.6, lp);
  o.connect(trem);
  rattle.connect(gain(c, 0.25, trem));
  lfo(c, trem.gain, 31, 0.4, t, dur);
  [[0, 0.4], [0.55, 0.4], [1.4, 0.4], [1.95, 0.4]].forEach(([s, d]) => {
    g.gain.setTargetAtTime(0.45, t + s, 0.01);
    g.gain.setTargetAtTime(0.0001, t + s + d, 0.015);
  });
  o.start(t);
  rattle.start(t);
  o.stop(t + dur);
  rattle.stop(t + dur);
}

function doorbell(c, out) {
  const t = now(c);
  [[659.25, 0], [523.25, 0.55]].forEach(([f, dt]) => {
    tone(c, out, { freq: f, t: t + dt, release: 1.4, peak: 0.35 });
    tone(c, out, { freq: f * 2.01, t: t + dt, release: 0.6, peak: 0.08 });
    tone(c, out, { freq: f * 3, t: t + dt, release: 0.3, peak: 0.04 });
  });
}

function carHorn(c, out) {
  const t = now(c);
  const lp = filter(c, 'lowpass', 1800, 1);
  lp.connect(out);
  [[0, 0.14], [0.24, 0.6]].forEach(([s, d]) => {
    for (const f of [349, 440]) {
      tone(c, lp, { type: 'sawtooth', freq: f, t: t + s, attack: 0.01, hold: d, release: 0.05, peak: 0.12 });
    }
  });
}

function mosquito(c, out) {
  const t = now(c);
  const dur = 2.6;
  const o = c.createOscillator();
  o.type = 'sawtooth';
  o.frequency.value = 620;
  lfo(c, o.frequency, 5, 35, t, dur);
  lfo(c, o.frequency, 0.7, 80, t, dur);
  const bp = filter(c, 'bandpass', 1200, 1.5);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.14, t + 1.2);
  g.gain.exponentialRampToValueAtTime(0.03, t + 1.8);
  g.gain.exponentialRampToValueAtTime(0.18, t + 2.3);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  const p = panner(c, out);
  if (p) {
    p.pan.setValueAtTime(-1, t);
    p.pan.linearRampToValueAtTime(1, t + 1.3);
    p.pan.linearRampToValueAtTime(-0.6, t + dur);
    g.connect(p);
  } else {
    g.connect(out);
  }
  o.connect(bp);
  bp.connect(g);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function printerJam(c, out) {
  const t = now(c);
  const g = gain(c, 0.0001, out);
  const grind = c.createOscillator();
  grind.type = 'square';
  grind.frequency.value = 55;
  grind.connect(gain(c, 0.35, g));
  const n = noise(c);
  const bp = filter(c, 'bandpass', 900, 2);
  n.connect(bp);
  bp.connect(gain(c, 0.8, g));
  // Stuttering grind that slows down as it jams.
  let s = 0;
  let step = 0.08;
  while (s < 1.6) {
    g.gain.setValueAtTime(0.28, t + s);
    g.gain.setValueAtTime(0.04, t + s + step * 0.6);
    s += step;
    step *= 1.06;
  }
  g.gain.setValueAtTime(0.0001, t + 1.65);
  grind.start(t);
  n.start(t);
  grind.stop(t + 1.7);
  n.stop(t + 1.7);
  // Clunk + angry error beeps.
  tone(c, out, { freq: 120, freqEnd: 45, t: t + 1.7, release: 0.3, peak: 0.5 });
  tone(c, out, { type: 'square', freq: 1400, t: t + 2.0, hold: 0.08, release: 0.03, peak: 0.08 });
  tone(c, out, { type: 'square', freq: 1400, t: t + 2.18, hold: 0.08, release: 0.03, peak: 0.08 });
}

function mailDing(c, out) {
  const t = now(c);
  tone(c, out, { freq: 1568, t, release: 0.9, peak: 0.3 });
  tone(c, out, { freq: 3140, t, release: 0.4, peak: 0.07 });
  tone(c, out, { freq: 2093, t: t + 0.12, release: 1.0, peak: 0.25 });
  tone(c, out, { freq: 4190, t: t + 0.12, release: 0.4, peak: 0.05 });
}

function lowBattery(c, out) {
  const t = now(c);
  [1046, 784, 523].forEach((f, i) => {
    tone(c, out, { type: 'triangle', freq: f, t: t + i * 0.22, hold: 0.12, release: 0.08, peak: 0.25 });
  });
}

function boo(c, out) {
  const t = now(c);
  const dur = 1.8;
  // Echo tail.
  const delay = c.createDelay(1);
  delay.delayTime.value = 0.28;
  const fb = gain(c, 0.4);
  const damp = filter(c, 'lowpass', 1200);
  delay.connect(damp);
  damp.connect(fb);
  fb.connect(delay);
  damp.connect(out);

  const voice = c.createGain();
  voice.gain.setValueAtTime(0.0001, t);
  voice.gain.exponentialRampToValueAtTime(0.6, t + 0.25);
  voice.gain.setValueAtTime(0.6, t + 0.85);
  voice.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  voice.connect(out);
  voice.connect(gain(c, 0.5, delay));

  const o = c.createOscillator();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(150, t);
  o.frequency.exponentialRampToValueAtTime(80, t + dur);
  lfo(c, o.frequency, 5, 6, t, dur);
  // "oo" formants
  for (const [f, q, a] of [[350, 5, 1], [800, 8, 0.4]]) {
    const bp = filter(c, 'bandpass', f, q);
    o.connect(bp);
    bp.connect(gain(c, a, voice));
  }
  const breath = noise(c);
  const lp = filter(c, 'lowpass', 700);
  breath.connect(lp);
  lp.connect(gain(c, 0.15, voice));
  o.start(t);
  breath.start(t);
  o.stop(t + dur + 0.05);
  breath.stop(t + dur + 0.05);
}

// ---------------------------------------------------------------- ui sfx

export function crinkle() {
  const { ctx: c, out } = audio();
  const t = now(c);
  const n = noise(c);
  const hp = filter(c, 'highpass', 2500);
  const g = gain(c, 0.0001, out);
  n.connect(hp);
  hp.connect(g);
  for (let i = 0; i < 16; i++) {
    const s = t + i * 0.035 + Math.random() * 0.02;
    g.gain.setValueAtTime(0.05 + Math.random() * 0.25, s);
    g.gain.setTargetAtTime(0.0001, s + 0.005, 0.008);
  }
  n.start(t);
  n.stop(t + 0.7);
}

export function pop() {
  const { ctx: c, out } = audio();
  const t = now(c);
  tone(c, out, { freq: 900, freqEnd: 120, t, attack: 0.002, release: 0.12, peak: 0.4 });
  const n = noise(c);
  const bp = filter(c, 'bandpass', 1800, 0.8);
  n.connect(bp);
  bp.connect(envelope(c, out, t, { attack: 0.001, release: 0.08, peak: 0.3 }));
  n.start(t);
  n.stop(t + 0.15);
}

// ---------------------------------------------------------------- registry

const wrap = (fn) => () => {
  const { ctx: c, out } = audio();
  fn(c, out);
};

export const SOUNDS = [
  { id: 'meeting', emoji: '📅', name: 'Hated meeting', quip: 'Starting now. Camera on, please.', ...fromFile('sounds/ms-teams-meet-up-reminder.mp3') },
  { id: 'call', emoji: '📞', name: 'Incoming work call', quip: 'Your manager wants a "quick sync".', play: wrap(teamsCall) },
  { id: 'alarm', emoji: '⏰', name: 'Morning alarm', quip: 'It is 6:00 AM. Forever.', play: wrap(alarm) },
  { id: 'fork', emoji: '🍴', name: 'Fork on a plate', quip: 'Pure, distilled horror.', play: wrap(forkOnPlate) },
  { id: 'vibrate', emoji: '📳', name: 'Phone buzzing on a table', quip: "It's not yours. Or is it?", play: wrap(phoneVibrate) },
  { id: 'doorbell', emoji: '🔔', name: 'Doorbell', quip: "Who's there? Nobody. Nobody is there.", play: wrap(doorbell) },
  { id: 'horn', emoji: '🚗', name: 'Car horn', quip: 'The light turned green 0.2s ago.', play: wrap(carHorn) },
  { id: 'mosquito', emoji: '🦟', name: 'Mosquito by your ear', quip: 'Lights out. Bzzzz.', play: wrap(mosquito) },
  { id: 'printer', emoji: '🖨️', name: 'Printer jam', quip: 'PC LOAD LETTER?!', play: wrap(printerJam) },
  { id: 'mail', emoji: '📧', name: 'New email ding', quip: '"Per my last email…"', play: wrap(mailDing) },
  { id: 'battery', emoji: '🪫', name: 'Low battery', quip: '1% and no charger in sight.', play: wrap(lowBattery) },
];

export const BONUS = {
  id: 'boo', emoji: '👻', name: 'A REAL GHOST', quip: 'BOOOOO! You found the rare one.', rare: true, play: wrap(boo),
};
