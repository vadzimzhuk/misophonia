import { SOUNDS, BONUS } from './sounds.js';

const BONUS_CHANCE = 0.05;

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Hides a random sound inside every candy and keeps track of what was opened. */
export class Game {
  constructor() {
    this.hidden = [];
    this.opened = new Set();
    this.history = [];
  }

  /** Deal `count` hidden sounds. Draws from shuffled bags so repeats are spread out. */
  deal(count) {
    this.hidden = [];
    this.opened.clear();
    let bag = [];
    while (this.hidden.length < count) {
      if (!bag.length) bag = shuffle([...SOUNDS]);
      this.hidden.push(Math.random() < BONUS_CHANCE ? BONUS : bag.pop());
    }
  }

  isOpened(index) {
    return this.opened.has(index);
  }

  /** Open a candy and return its sound (or null if already opened). */
  open(index) {
    if (this.opened.has(index) || !this.hidden[index]) return null;
    this.opened.add(index);
    const sound = this.hidden[index];
    this.history.unshift(sound);
    return sound;
  }

  get remaining() {
    return this.hidden.length - this.opened.size;
  }
}
