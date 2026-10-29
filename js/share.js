import { track } from './analytics.js';

const GREETINGS = [
  'Happy Halloween! 🎃',
  'Have a spooky Halloween! 👻',
  'Trick or treat… and happy Halloween! 🍬🎃',
  'Happy Halloween from the candy bowl of doom! 🦇',
];

const enc = encodeURIComponent;

// Facebook only takes a link (no pre-filled text), so its text is copied to the clipboard instead.
const TARGETS = {
  x: (text, url) => `https://x.com/intent/post?text=${enc(text)}&url=${enc(url)}`,
  facebook: (text, url) => `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`,
  linkedin: (text, url) => `https://www.linkedin.com/feed/?shareActive=true&text=${enc(`${text} ${url}`)}`,
  threads: (text, url) => `https://www.threads.net/intent/post?text=${enc(`${text} ${url}`)}`,
};

const pick = (list) => list[Math.floor(Math.random() * list.length)];
const pageUrl = () => location.origin + location.pathname;

/** `total` = candies opened, `worst` = the sound you rated most irritating (or the latest one). */
export function shareText({ total, worst }) {
  const greeting = pick(GREETINGS);
  if (!total || !worst) return `Can you survive a bowl full of the most hated sounds? 🍬 ${greeting}`;
  if (total === 1) return `I survived ${worst.emoji} ${worst.name}… barely. How many hated sounds can you take? ${greeting}`;
  return `I survived ${total} hated sounds but almost gave up on the ${worst.emoji} ${worst.name} one! ${greeting}`;
}

export function initShare(getStats) {
  const dialog = document.getElementById('share');
  const textarea = document.getElementById('share-text');
  const status = document.getElementById('share-status');
  const nativeBtn = dialog.querySelector('[data-share="native"]');
  nativeBtn.hidden = !navigator.share;

  const openBtn = document.getElementById('share-open');
  let openedByPointer = false;
  openBtn.addEventListener('click', (e) => {
    openedByPointer = e.detail > 0; // 0 = activated from the keyboard
    textarea.value = shareText(getStats());
    status.textContent = '';
    dialog.showModal();
  });

  // Keyboard users get focus back on the Share button; mouse users get Space back for grabbing candy.
  dialog.addEventListener('close', () => {
    if (openedByPointer) openBtn.blur();
  });

  // Clicking the backdrop closes the dialog.
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });

  // Synchronous copy, so a popup opened right after still counts as a user action.
  // The helper lives inside the dialog because everything outside a modal dialog is inert.
  function copyNow(text) {
    const tmp = document.createElement('textarea');
    tmp.value = text;
    tmp.setAttribute('readonly', '');
    tmp.className = 'share-clipboard';
    dialog.appendChild(tmp);
    tmp.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    tmp.remove();
    return ok;
  }

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return copyNow(text);
    }
  }

  dialog.querySelectorAll('[data-share]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const method = btn.dataset.share;
      const text = textarea.value.trim();
      const url = pageUrl();
      const { total, worst } = getStats();
      status.textContent = '';
      track('share', { method, content_type: 'result', item_id: worst?.id ?? 'none', sounds_survived: total });

      if (method === 'copy') {
        status.textContent = (await copy(`${text} ${url}`)) ? 'Copied! Paste it anywhere 👻' : 'Copy failed. Select the text and copy it manually.';
        return;
      }
      if (method === 'native') {
        navigator.share({ title: document.title, text, url }).catch(() => {});
        return;
      }
      if (method === 'facebook') {
        status.textContent = copyNow(text)
          ? 'Facebook doesn’t allow pre-filled text, so your message is copied. Just paste it into the post.'
          : 'Facebook doesn’t allow pre-filled text. Copy your message above and paste it into the post.';
      }
      window.open(TARGETS[method](text, url), '_blank', 'noopener,noreferrer,width=640,height=680');
    });
  });
}
