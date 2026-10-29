# 🎃 SpookySoundBox

Trick or treat! A bowl of 13 identical mystery candies sits on a candle-lit table.
Grab one, it unwraps with a pop… and plays a random sound you never wanted to hear on Halloween:

📅 a hated meeting reminder · ⏰ the morning alarm · 🍴 a fork squeaking on a plate · 🦟 a mosquito ·
🖨️ a printer · 😋 loud chewing · 🍜 slurping · 😴 snoring · 🛠️ the neighbor's drill · 🚗 a car alarm ·
🚨 a police siren · 🚪 a creaky door · 💨 a wet fart · 🤮 someone throwing up … and a rare 👻 **real ghost**.

Sounds are recorded clips in `sounds/`, downloaded in the background on page load and capped at 10 seconds (longer clips fade out).
The rare ghost and the unwrap/pop effects are **synthesized live with the Web Audio API**.
The 3D scene uses [three.js](https://threejs.org) loaded from a CDN via an import map, so there's **no build step**.

## Controls

- **Click / tap** a candy to unwrap it
- **Drag** to orbit around the bowl, scroll to zoom
- **Space** grabs a random candy (or refills an empty bowl)
- 🍬 **Refill bowl** re-deals new hidden sounds, 🔊 toggles mute
- 📣 **Share** brags on X, Facebook, LinkedIn or Threads: *"I survived 7 hated sounds but almost gave up on the 🛠️ Neighbor's drill one! Happy Halloween! 🎃"*

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

## Sharing

The share message counts the candies you opened and names the sound you rated most irritating
(or the latest one if you haven't voted). X, LinkedIn and Threads get the text pre-filled; Facebook only
accepts a link, so the text is copied to the clipboard for pasting. On phones, **More…** opens the system share sheet.

Link previews come from the Open Graph tags in `index.html` and `og-image.jpg`. They use the absolute URL
`https://vadzimzhuk.github.io/misophonia/`, so update them if the site moves. After changing them, refresh the cached
preview with the [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/) and the
[LinkedIn Post Inspector](https://www.linkedin.com/post-inspector/).

## Analytics

Firebase Analytics (`js/analytics.js`) counts visits automatically (`page_view`, `session_start`) and logs a
`candy_opened` event with `sound_id`, `sound_name` and `rare` for every unwrapped candy, and a `share` event
(`method` = x / facebook / linkedin / threads / copy / native) for every share button press.
The toast that pops up also has a 5-star "how irritating was that?" rating; each vote logs a `sound_rated`
event with `sound_id`, `sound_name` and `rating` (1–5), and is remembered in `localStorage` for that browser.
It's off on `localhost` so testing doesn't skew the numbers; open `http://localhost:8000/?analytics` to test it.
If the SDK is blocked (ad blockers, offline), the app keeps working without it.

## Project layout

| File | What it does |
| --- | --- |
| `index.html` | Page shell, HUD and three.js import map |
| `style.css` | Halloween theme, HUD, toast and fallback styles |
| `js/main.js` | Wires up the game, the view and the HUD |
| `js/analytics.js` | Firebase Analytics setup and `track()` helper |
| `js/share.js` | Share dialog, message wording and social share links |
| `og-image.jpg` | 1200×630 link-preview image |
| `js/game.js` | Deals a hidden sound to each candy and tracks what you've opened |
| `js/sounds.js` | Sound library, 10 s playback cap and synthesized effects — add a new sound to `SOUNDS` here |
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

`fromFile(url, volume)` takes an optional volume (default `1`) to balance loud recordings against the rest;
the current values bring each clip to roughly the same loudness (about -20 dBFS RMS).
Only publish recordings you're allowed to share (your own, or CC0 from e.g. Freesound / Pixabay).

**Synthesized:** write a function `(ctx, out) => { ... }` that schedules some Web Audio nodes into `out`
and use `play: wrap(yourFunction)` in the entry instead (see the ghost's `boo()`).
