# 🎃 SpookySoundBox

Trick or treat! A bowl of 13 identical mystery candies sits on a candle-lit table.
Grab one, it unwraps with a pop… and plays a random sound you never wanted to hear on Halloween:

📅 a hated meeting reminder · 📞 a work call · ⏰ the morning alarm · 🍴 a fork scraping a plate ·
📳 a phone buzzing on the table · 🔔 a doorbell · 🚗 a car horn · 🦟 a mosquito by your ear ·
🖨️ a printer jam · 📧 a new email · 🪫 low battery … and a rare 👻 **real ghost**.

Most sounds are **synthesized live with the Web Audio API**; recorded clips live in `sounds/` and are preloaded on the first click.
The 3D scene uses [three.js](https://threejs.org) loaded from a CDN via an import map, so there's **no build step**.

## Controls

- **Click / tap** a candy to unwrap it
- **Drag** to orbit around the bowl, scroll to zoom
- **Space** grabs a random candy (or refills an empty bowl)
- 🍬 **Refill bowl** re-deals new hidden sounds, 🔊 toggles mute

If WebGL isn't available, it falls back to a simple 2D candy bowl.

## Run locally

ES modules need to be served over HTTP (opening `index.html` directly won't work):

```sh
python3 -m http.server 8000
# or: npx serve .
```

Then open <http://localhost:8000>.

## Deploy to GitHub Pages

```sh
git init && git add . && git commit -m "SpookySoundBox"
git branch -M main
git remote add origin git@github.com:<you>/SpookySoundBox.git
git push -u origin main
```

Then go to **Settings → Pages → Build and deployment → Deploy from a branch → `main` / `(root)`**.
The site will be live at `https://<you>.github.io/SpookySoundBox/`.

## Project layout

| File | What it does |
| --- | --- |
| `index.html` | Page shell, HUD and three.js import map |
| `style.css` | Halloween theme, HUD, toast and fallback styles |
| `js/main.js` | Wires up the game, the view and the HUD |
| `js/game.js` | Deals a hidden sound to each candy and tracks what you've opened |
| `js/sounds.js` | Sound library (synths + recorded files) — add a new sound to `SOUNDS` here |
| `sounds/` | Recorded sound clips (MP3) |
| `js/scene.js` | three.js scene: pumpkin bowl, candles, bats, picking and animations |
| `js/candy.js` | Wrapped candy mesh factory |
| `js/fallback.js` | Non-WebGL fallback bowl |

### Adding a sound

**From a file:** drop an MP3 (mono, 44.1 kHz, 96–128 kbps, leading silence trimmed) into `sounds/` and add an
entry to `SOUNDS` in `js/sounds.js`:

```js
{ id: 'kettle', emoji: '🫖', name: 'Kettle whistle', quip: 'Tea time. Forever.', ...fromFile('sounds/kettle.mp3') },
```

`fromFile(url, volume)` takes an optional volume (default `1`) to balance loud recordings against the rest.
Only publish recordings you're allowed to share (your own, or CC0 from e.g. Freesound / Pixabay).

**Synthesized:** write a function `(ctx, out) => { ... }` that schedules some Web Audio nodes into `out`
and use `play: wrap(yourFunction)` in the entry instead.
