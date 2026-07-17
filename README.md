# 🛡️ Reddit Positivity Filter

[![Downloads](https://img.shields.io/github/downloads/Rishabh-creator601/Reddit-filters/total?color=0079d3&label=downloads)](https://github.com/Rishabh-creator601/Reddit-filters/releases)
[![Latest release](https://img.shields.io/github/v/release/Rishabh-creator601/Reddit-filters?color=0079d3)](https://github.com/Rishabh-creator601/Reddit-filters/releases/latest)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-0079d3)

A privacy-first Chrome / Edge extension that keeps **negative, vulgar and adult content off your Reddit** — and helps you discover the communities you actually care about.

Everything runs **locally in your browser**. No servers, no tracking, no data ever leaves your machine.

---

## 📸 Screenshots

<table>
<tr>
<td align="center"><b>Filter &amp; settings</b></td>
<td align="center"><b>Find &amp; block communities</b></td>
</tr>
<tr>
<td><img src="docs/screenshots/popup-filter.png" width="330" alt="Filter tab" /></td>
<td><img src="docs/screenshots/popup-finder.png" width="330" alt="Find communities tab" /></td>
</tr>
</table>

---

## ⬇️ Download

**[⬇️ Download reddit-positivity-filter.zip](https://github.com/Rishabh-creator601/Reddit-filters/releases/latest/download/reddit-positivity-filter.zip)** — then follow the install steps below.

*(Downloads are counted via GitHub Releases — see the downloads badge above.)*

---

## ✨ Features

| Feature | What it does |
|---|---|
| 🏡 **Home-feed allowlist** | Flip one switch and **only the communities you allow appear on your home feed** — every other community's posts are silently removed. Community pages you open directly are unaffected. |
| 🔒 **Home-feed full block** | Optionally block the home feed **entirely** with a block screen. 💬 Chat (including chat requests) and 🔔 notifications are never blocked — the block screen links straight to both, and it has a built-in 🔎 **community search** so you can still find and open communities without ever seeing the feed. |
| 🚫 **Adult / NSFW blocking** | Hides every post Reddit flags `over_18`, and shows a full-page block on any 18+ community so you can't view or join it. Can be **locked** so it can't be switched off. |
| 🧹 **Keyword filter** | Hides posts/comments mentioning topics you choose — ships with violence, abuse, cheating, profanity, film industry (Bollywood/Hollywood) and warfare. Fully editable. |
| 🧩 **Theme filter (concept blocking)** | Blocks a post when a **majority of a theme's concepts appear together** — e.g. *safety + women + country + laws* — even if you never typed the exact phrase. Each concept is a few seed words; a built-in **Test it** box shows exactly why a post would block. Matches are hard-hidden. |
| 🖼️ **Explicit-image AI** | An on-device TensorFlow.js model (NSFWJS) blurs nude/explicit images. Optional "revealing" mode + sensitivity slider. No image leaves your browser. |
| 🔤 **Text-in-image OCR** | An on-device OCR engine (Tesseract.js) reads text **baked into images** — screenshots, memes — and runs it through your keyword *and* theme filters, so image-only posts can't slip past. Off by default (OCR is slow); everything runs locally. |
| 🔎 **Community finder** | Type an interest (e.g. *machine learning*) and get the top ~20 relevant communities, including related ones, ranked by relevance + popularity. |
| ⛔ **Block any community** | A floating **Block** button on every subreddit, plus **Block** buttons in the finder. Blocked communities are hidden everywhere and their pages are blocked. |
| 💾 **Backup & restore** | Export your keywords and blocked communities to a file and import them on another computer. |

---

## 🔧 Install (Developer Mode — ~30 seconds)

1. **[Download the ZIP](https://github.com/Rishabh-creator601/Reddit-filters/releases/latest/download/reddit-positivity-filter.zip)** and unzip it (or `git clone` this repo).
2. Open **Chrome** → `chrome://extensions` (Edge → `edge://extensions`).
3. Turn on **Developer mode** (top-right).
4. Click **Load unpacked** and select the unzipped folder.
5. Open **reddit.com** — filtering starts immediately. Click the toolbar icon for settings.

> Updating the code later? Click the **↻ reload** icon on the extension card and refresh your Reddit tab.

---

## 📖 How to use

Click the extension's toolbar icon to open the popup. It has two tabs.

### Filter tab
- **Enable keyword filtering** — master switch for the word list.
- **Block all adult / NSFW** — hides Reddit-flagged adult posts and blocks 18+ community pages (on by default).
  - **🔒 Lock this on** — makes adult blocking permanent (can't be toggled off in the popup). *Note: uninstalling the extension is the only way to remove it — no browser extension can be truly un-undoable.*
- **Strict whole-word match** — reduces false hits (e.g. stops "war" matching "warm").
- **🏡 Home-feed allowlist** — turn on **Only show my allowed communities on the home feed**, then build the list without guessing names: **search** Reddit right inside the section and click **＋ Allow** on real communities, or type names one per line and hit **✔ Verify** to confirm each one exists (it also fixes capitalization and flags typos like a misspelled community). Everything else disappears from the home feed; visiting a community page directly still works.
- **🔒 Home-feed full block** — turn on **Block the home feed completely** to replace the home feed with a block screen. Chat, chat requests and notifications keep working — the block screen has direct 💬 chat and 🔔 notifications buttons, plus a 🔎 search box that finds communities (blocked and 18+ ones excluded) and opens them directly.
- **Keyword box** — one word/phrase per line; click **Save filter**.
- **🧩 Theme filters** — define a *theme* as a few **concepts** (each a short list of seed words). A post is blocked when a **majority of the concepts appear together**, so you catch a whole topic without listing every phrasing. Tune how many concepts must connect, use the **Test it** box to preview a match, and **Save themes**. Ships with an editable starter theme.
- **💾 Backup & restore** — **Export** your setup to a file, or **Import** it back.
- **🔞 Explicit image filter** — toggle image blurring, optionally include "revealing" images, and set sensitivity. The ~7 MB AI model loads once on first use.

Hidden items appear as a small "🚫 Hidden" bar. Keyword matches offer **Show anyway**; adult/blocked content is hard-hidden with no reveal.

### Find communities tab
- **Blocked communities** — a live list of everything you've blocked, each with an un-block **×**.
- **Search box** — type an interest and press **Find communities**.
- Each result has a **Block** button — blocks that community everywhere.

### On Reddit itself
- Visit any community and a floating **🚫 Block r/…** button appears in the bottom-right. One click blocks it: the page is blocked, its posts vanish from your feeds, and it won't be recommended.

---

## 🔒 Privacy

- **No external servers.** Filtering and image classification run entirely in your browser.
- The community finder talks **only to Reddit's own API**, using your existing session.
- No analytics, no telemetry, no accounts.

---

## 🗂️ Project structure

```
manifest.json      Extension config (Manifest V3)
content.js         Filtering, NSFW/community blocking, block button, finder, OCR pipeline
content.css        Styles for hidden posts, block page, block button
popup.html/js      Toolbar UI (filters, themes, image AI, OCR, finder, blocked list, backup)
background.js      Service worker — manages the OCR offscreen document
offscreen.html/js  Offscreen document that runs on-device OCR (Tesseract.js)
icons/             Extension icons (16/32/48/128) referenced by the manifest
vendor/            TensorFlow.js + NSFWJS + Tesseract.js (official builds, run locally; see vendor/README.md)
model/             NSFWJS MobileNetV2 weights (bundled)
store/             Chrome Web Store listing assets (screenshots + promo banners)
tools/             Scripts that generate the icons and store assets
```

---

## ⚙️ Tech

- Manifest V3 · vanilla JS (no build step)
- [TensorFlow.js](https://www.tensorflow.org/js) + [NSFWJS](https://github.com/infinitered/nsfwjs) for on-device image classification
- Reddit's public JSON API for NSFW flags and community search
