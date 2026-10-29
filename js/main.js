import { track } from './analytics.js';
import { Game } from './game.js';
import { initShare } from './share.js';
import { audio, crinkle, pop, setMuted, isMuted, stopCurrent } from './sounds.js';

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
      addToLoot(sound);
      updateHud();
      track('candy_opened', { sound_id: sound.id, sound_name: sound.name, rare: sound.rare ? 1 : 0 });
    },
  });
  if (ok) {
    stopCurrent(); // opening the next candy silences the previous sound
    crinkle();
  }
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
  toast.append(emoji, name, quip, ratingView(sound));
  toast.classList.toggle('rare', !!sound.rare);
  toast.classList.remove('show');
  void toast.offsetWidth; // restart the animation
  toast.classList.add('show');
  hideToastIn(6000);
}

function hideToastIn(ms) {
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), ms);
}

// Keep the toast open while the pointer is on it, so there's time to vote.
toast.addEventListener('pointerenter', () => clearTimeout(toastTimer));
toast.addEventListener('pointerleave', () => {
  if (toast.classList.contains('show')) hideToastIn(2500);
});

// ---------------------------------------------------------------- rating

const RATINGS_KEY = 'misophonia.ratings';

function loadRatings() {
  try {
    return JSON.parse(localStorage.getItem(RATINGS_KEY)) || {};
  } catch {
    return {};
  }
}

function saveRating(id, stars) {
  const ratings = loadRatings();
  ratings[id] = stars;
  try {
    localStorage.setItem(RATINGS_KEY, JSON.stringify(ratings));
  } catch {
    // Private mode or storage full: the vote is still sent to analytics.
  }
}

/** Five stars for "how irritating was that?". */
function ratingView(sound) {
  const wrap = document.createElement('div');
  wrap.className = 'rating';
  const label = document.createElement('div');
  label.className = 'rating-label';
  const stars = document.createElement('div');
  stars.className = 'stars';
  stars.setAttribute('role', 'group');
  stars.setAttribute('aria-label', 'Rate how irritating this sound is');

  const previous = loadRatings()[sound.id] || 0;
  const paint = (value) => {
    [...stars.children].forEach((b, i) => {
      const on = i < value;
      b.classList.toggle('filled', on);
      b.textContent = on ? '★' : '☆';
      b.setAttribute('aria-pressed', String(i + 1 === value));
    });
    label.textContent = value
      ? `Your rage level: ${value}/5 ${'😤'.repeat(Math.ceil(value / 2))}`
      : 'How irritating was that?';
  };

  for (let i = 1; i <= 5; i++) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'star';
    b.setAttribute('aria-label', `${i} of 5`);
    b.addEventListener('click', () => {
      saveRating(sound.id, i);
      track('sound_rated', { sound_id: sound.id, sound_name: sound.name, rating: i });
      paint(i);
      b.blur(); // the toast is going away; give Space back to "grab a candy"
      clearTimeout(toastTimer);
      toast.classList.remove('show');
      renderLoot();
    });
    stars.appendChild(b);
  }
  paint(previous);
  wrap.append(stars, label);
  return wrap;
}

// ---------------------------------------------------------------- loot list

const loot = new Map(); // sound id -> { sound, count, last }
let lootSeq = 0;

function addToLoot(sound) {
  const entry = loot.get(sound.id) ?? { sound, count: 0 };
  entry.count++;
  entry.last = ++lootSeq;
  loot.set(sound.id, entry);
  renderLoot();
}

/** Opened sounds ranked by your vote (unrated last, then most recent first). */
function rankedLoot() {
  const ratings = loadRatings();
  return [...loot.values()]
    .map((e) => ({ ...e, rating: ratings[e.sound.id] || 0 }))
    .sort((a, b) => b.rating - a.rating || b.last - a.last);
}

function renderLoot() {
  history.replaceChildren(...rankedLoot().map(({ sound, count, rating }) => {
    const li = document.createElement('li');
    if (sound.rare) li.className = 'rare';
    const name = document.createElement('span');
    name.className = 'loot-name';
    name.textContent = `${sound.emoji} ${sound.name}${count > 1 ? ` ×${count}` : ''}`;
    const score = document.createElement('span');
    score.className = rating ? 'loot-score' : 'loot-score unrated';
    score.textContent = rating ? String(rating) : '–';
    score.title = rating ? `Your rage level: ${rating}/5` : 'Not rated yet';
    li.append(name, score);
    return li;
  }));
}

function updateHud() {
  const n = game.remaining;
  left.textContent = n;
  const empty = n === 0;
  refillBtn.classList.toggle('pulse', empty);
  hint.textContent = empty ? 'The bowl is empty… refill, or brag about it 📣' : 'Pick a candy… if you dare 🎃';
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

initShare(() => {
  const rows = rankedLoot();
  return { total: rows.reduce((n, r) => n + r.count, 0), worst: rows[0]?.sound };
});

window.addEventListener('keydown', (e) => {
  if (!view || e.code !== 'Space' || e.target.closest?.('textarea, input, dialog')) return;
  // A button reached with the keyboard keeps Space; one that only has focus from a mouse click
  // (or focus returning from the share dialog) gives it back to "grab a candy".
  const button = e.target.closest?.('button');
  if (button?.matches(':focus-visible')) return;
  button?.blur();
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
