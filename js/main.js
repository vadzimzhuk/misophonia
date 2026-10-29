import { track } from './analytics.js';
import { Game } from './game.js';
import { audio, crinkle, pop, setMuted, isMuted } from './sounds.js';

const $ = (id) => document.getElementById(id);
const stage = $('stage');
const hint = $('hint');
const left = $('left');
const history = $('history');
const toast = $('toast');
const refillBtn = $('refill');
const muteBtn = $('mute');

const game = new Game();
let view = null;
let toastTimer = 0;

function webglAvailable() {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

function onPick(index) {
  if (game.isOpened(index)) return;
  audio(); // unlock audio inside the user gesture
  const ok = view.reveal(index, {
    onPop() {
      const sound = game.open(index);
      if (!sound) return;
      pop();
      sound.play();
      showToast(sound);
      addHistory(sound);
      updateHud();
      track('candy_opened', { sound_id: sound.id, sound_name: sound.name, rare: sound.rare ? 1 : 0 });
    },
  });
  if (ok) crinkle();
}

function showToast(sound) {
  toast.innerHTML = '';
  const emoji = document.createElement('div');
  emoji.className = 'toast-emoji';
  emoji.textContent = sound.emoji;
  const name = document.createElement('div');
  name.className = 'toast-name';
  name.textContent = sound.name;
  const quip = document.createElement('div');
  quip.className = 'toast-quip';
  quip.textContent = sound.quip;
  toast.append(emoji, name, quip);
  toast.classList.toggle('rare', !!sound.rare);
  toast.classList.remove('show');
  void toast.offsetWidth; // restart the animation
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
}

function addHistory(sound) {
  const li = document.createElement('li');
  li.textContent = `${sound.emoji} ${sound.name}`;
  if (sound.rare) li.className = 'rare';
  history.prepend(li);
  while (history.children.length > 13) history.lastChild.remove();
}

function updateHud() {
  const n = game.remaining;
  left.textContent = n;
  const empty = n === 0;
  refillBtn.classList.toggle('pulse', empty);
  hint.textContent = empty ? 'The bowl is empty… refill for more tricks!' : 'Pick a candy… if you dare 🎃';
}

function refill() {
  game.deal(view.count);
  view.fill();
  updateHud();
}

refillBtn.addEventListener('click', () => {
  audio();
  refill();
});

muteBtn.addEventListener('click', () => {
  setMuted(!isMuted());
  muteBtn.textContent = isMuted() ? '🔇' : '🔊';
  muteBtn.setAttribute('aria-pressed', String(isMuted()));
});

window.addEventListener('keydown', (e) => {
  if (!view || e.code !== 'Space' || e.target.closest?.('button')) return;
  e.preventDefault();
  if (game.remaining === 0) refill();
  else view.pickRandom();
});

async function init() {
  if (webglAvailable()) {
    try {
      const { createScene } = await import('./scene.js');
      view = createScene(stage, { onPick });
    } catch (err) {
      console.warn('3D scene unavailable, falling back to the simple bowl.', err);
    }
  }
  if (!view) {
    const { createFallback } = await import('./fallback.js');
    view = createFallback(stage, { onPick });
    document.body.classList.add('no-webgl');
  }
  document.body.classList.add('ready');
  refill();
}

init();
