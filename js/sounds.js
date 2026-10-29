// The sound library is recorded clips from /sounds; the rare ghost and the UI effects are synthesized live.

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

const now = (c) => c.currentTime + 0.02;

// ---------------------------------------------------------------- recorded files

const MAX_SECONDS = 10;
const FADE_SECONDS = 0.6;

const files = new Map(); // url -> Promise<ArrayBuffer>
const buffers = new Map(); // url -> Promise<AudioBuffer>

function fetchFile(url) {
  if (!files.has(url)) {
    const loading = fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
        return res.arrayBuffer();
      })
      .catch((err) => {
        files.delete(url); // allow a retry on the next pick
        throw err;
      });
    files.set(url, loading);
  }
  return files.get(url);
}

function loadBuffer(url) {
  if (!buffers.has(url)) {
    const { ctx: c } = audio();
    const decoding = fetchFile(url)
      .then((data) => c.decodeAudioData(data))
      .catch((err) => {
        buffers.delete(url);
        files.delete(url);
        throw err;
      });
    buffers.set(url, decoding);
  }
  return buffers.get(url);
}

/**
 * Sound entry fields for a recorded file: `{ ...fromFile('sounds/x.mp3', volume) }`.
 * `volume` evens out loudness between recordings. Clips longer than 10 s fade out at 10 s.
 */
function fromFile(url, volume = 1) {
  return {
    url,
    async play() {
      try {
        const { ctx: c, out } = audio();
        const buffer = await loadBuffer(url);
        const src = c.createBufferSource();
        src.buffer = buffer;
        const g = gain(c, volume, out);
        src.connect(g);
        const t = c.currentTime;
        src.start(t);
        if (buffer.duration > MAX_SECONDS) {
          g.gain.setValueAtTime(volume, t + MAX_SECONDS - FADE_SECONDS);
          g.gain.linearRampToValueAtTime(0.0001, t + MAX_SECONDS);
          src.stop(t + MAX_SECONDS);
        }
      } catch (err) {
        console.warn('Could not play sound file', err);
      }
    },
  };
}

// ---------------------------------------------------------------- the rare ghost (synthesized)

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
  { id: 'meeting', emoji: '📅', name: 'Hated meeting', quip: 'Starting now. Camera on, please.', ...fromFile('sounds/meeting-reminder.mp3', 2.5) },
  { id: 'alarm', emoji: '⏰', name: 'Morning alarm', quip: 'It is 6:00 AM. Forever.', ...fromFile('sounds/alarm-clock.mp3', 0.6) },
  { id: 'fork', emoji: '🍴', name: 'Fork on a plate', quip: 'Pure, distilled horror.', ...fromFile('sounds/fork-on-plate.mp3', 0.9) },
  { id: 'mosquito', emoji: '🦟', name: 'Mosquito by your ear', quip: 'Lights out. Bzzzz.', ...fromFile('sounds/mosquito.mp3', 0.8) },
  { id: 'printer', emoji: '🖨️', name: 'Printer', quip: 'Printing 1 of 400 pages…', ...fromFile('sounds/printer.mp3', 1.7) },
  { id: 'chewing', emoji: '😋', name: 'Loud chewing', quip: 'Mouth open. Every. Single. Bite.', ...fromFile('sounds/chewing.mp3', 2.4) },
  { id: 'slurping', emoji: '🍜', name: 'Slurping', quip: 'The soup is gone. The slurping is not.', ...fromFile('sounds/slurping.mp3', 1.6) },
  { id: 'snoring', emoji: '😴', name: 'Snoring', quip: 'Sleep is for the other person.', ...fromFile('sounds/snoring.mp3', 1.2) },
  { id: 'drill', emoji: '🛠️', name: "Neighbor's drill", quip: 'Sunday, 8 AM. Of course.', ...fromFile('sounds/drill.mp3', 0.35) },
  { id: 'car-alarm', emoji: '🚗', name: 'Car alarm', quip: 'Nobody is stealing it. Nobody ever is.', ...fromFile('sounds/car-alarm.mp3', 0.4) },
  { id: 'siren', emoji: '🚨', name: 'Police siren', quip: 'Not for you. Probably.', ...fromFile('sounds/police-siren.mp3', 1.5) },
  { id: 'door', emoji: '🚪', name: 'Creaky door', quip: 'Someone is coming in. Slowly.', ...fromFile('sounds/door-creak.mp3', 1.3) },
  { id: 'fart', emoji: '💨', name: 'Wet fart', quip: 'In an elevator. Between floors.', ...fromFile('sounds/fart.mp3', 0.65) },
  { id: 'vomit', emoji: '🤮', name: 'Someone throwing up', quip: 'Too much Halloween candy.', ...fromFile('sounds/vomit.mp3', 1.9) },
];

// Start downloading clips right away; they're decoded on the first click.
for (const s of SOUNDS) fetchFile(s.url).catch(() => {});

export const BONUS = {
  id: 'boo', emoji: '👻', name: 'A REAL GHOST', quip: 'BOOOOO! You found the rare one.', rare: true, play: wrap(boo),
};
