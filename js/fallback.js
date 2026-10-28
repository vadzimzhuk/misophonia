// Plain DOM version of the candy bowl, used when WebGL or the three.js CDN is unavailable.

const COUNT = 13;

export function createFallback(container, { onPick }) {
  const bowl = document.createElement('div');
  bowl.className = 'fallback-bowl';
  container.appendChild(bowl);
  let buttons = [];

  function fill() {
    bowl.replaceChildren();
    buttons = Array.from({ length: COUNT }, (_, i) => {
      const b = document.createElement('button');
      b.className = 'fallback-candy';
      b.textContent = '🍬';
      b.setAttribute('aria-label', `Mystery candy ${i + 1}`);
      b.style.setProperty('--hue', `${Math.floor(Math.random() * 360)}deg`);
      b.style.animationDelay = `${i * 40}ms`;
      b.addEventListener('click', () => onPick(i));
      bowl.appendChild(b);
      return b;
    });
  }

  function reveal(index, { onPop } = {}) {
    const b = buttons[index];
    if (!b || b.disabled) return false;
    b.disabled = true;
    b.classList.add('opening');
    setTimeout(() => {
      b.classList.replace('opening', 'opened');
      b.textContent = '✨';
      onPop?.();
    }, 600);
    return true;
  }

  function pickRandom() {
    const idle = buttons.map((b, i) => (b.disabled ? -1 : i)).filter((i) => i >= 0);
    if (!idle.length) return false;
    onPick(idle[Math.floor(Math.random() * idle.length)]);
    return true;
  }

  return { count: COUNT, fill, reveal, pickRandom };
}
