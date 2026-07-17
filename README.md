# 🛡️ Reddit Positivity Filter

[![Downloads](https://img.shields.io/github/downloads/Rishabh-creator601/Reddit-filters/total?color=0079d3&label=downloads)](https://github.com/Rishabh-creator601/Reddit-filters/releases)
[![Latest release](https://img.shields.io/github/v/release/Rishabh-creator601/Reddit-filters?color=0079d3)](https://github.com/Rishabh-creator601/Reddit-filters/releases/latest)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-0079d3)

A privacy-first Chrome / Edge extension that puts **you** in charge of what Reddit shows you:

- **Your home feed, on your terms** — allow only the communities you choose, or switch the feed off entirely (chat and notifications keep working).
- **Negativity filtered out** — keywords, concept-based themes, adult content, explicit images, even text hidden inside memes.
- **Nothing leaves your browser** — all filtering and AI runs locally. No servers, no tracking, no accounts.

**Jump to:** [Download](#%EF%B8%8F-download) · [Features](#-features) · [Install](#-install-developer-mode--30-seconds) · [How to use](#-how-to-use) · [Privacy](#-privacy) · [FAQ](#-faq)

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

**[⬇️ Download reddit-positivity-filter.zip](https://github.com/Rishabh-creator601/Reddit-filters/releases/latest/download/reddit-positivity-filter.zip)** — then follow the [install steps](#-install-developer-mode--30-seconds) below.

*(Downloads are counted via GitHub Releases — see the downloads badge above.)*

---

## ✨ Features

### Take control of your home feed

| Feature | What it does |
|---|---|
| 🏡 **Allowlist mode** | **Only the communities you allow appear on your home feed** — every other community's posts are silently removed. Build the list safely: search Reddit inside the popup and click **＋ Allow**, or type names and **Verify** them against Reddit so typos can't slip in. |
| 🔒 **Full block mode** | Replace the home feed with a calm block screen. 💬 Chat (including chat requests) and 🔔 notifications are **never** blocked — the block screen links straight to both, and its built-in 🔎 community search lets you find and open communities without ever seeing the feed. |
| ⛔ **Block any community** | A floating **Block** button on every subreddit, plus **Block** buttons in the finder. Blocked communities vanish from every feed, their pages are blocked, and they're never recommended. |

### Filter out negativity

| Feature | What it does |
|---|---|
| 🧹 **Keyword filter** | Hides posts/comments mentioning topics you choose — ships with a starter list covering violence, abuse, cheating, profanity, celebrity/film-industry and warfare. Fully editable, with an optional strict whole-word mode. |
| 🧩 **Theme filter (concept blocking)** | Blocks a post when a **majority of a theme's concepts appear together** — e.g. *safety + women + country + laws* — even if you never typed the exact phrase. Each concept is a few seed words; a live **Test it** box shows exactly why a post would block. |
| 🚫 **Adult / NSFW blocking** | Hides every post Reddit flags `over_18` and full-page-blocks 18+ communities so you can't view or join them. Can be **locked on** so it can't be casually disabled. |
| 🖼️ **Explicit-image AI** | An on-device TensorFlow.js model (NSFWJS) blurs nude/explicit images, with an optional "revealing" mode and a sensitivity slider. |
| 🔤 **Text-in-image OCR** | An on-device OCR engine (Tesseract.js) reads text **baked into images** — screenshots, memes — and runs it through your keyword *and* theme filters, so image-only posts can't slip past. Off by default (OCR is slow). |

### And the practical bits

| Feature | What it does |
|---|---|
| 🔎 **Community finder** | Type an interest (e.g. *machine learning*) and get the top ~20 relevant communities, including related topics, ranked by relevance + popularity. |
| 💾 **Backup & restore** | Export your entire setup — keywords, themes, allowed & blocked communities, all toggles — to a JSON file and import it on another computer. |

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

Click the toolbar icon to open the popup. It has four tabs — **Home**, **Filters**, **Media**, **Discover** — plus a **Backup** footer that's always in reach.

### Home — your home feed, your rules

- **Block the home feed** — replaces the feed with a block screen. Chat, chat requests and notifications keep working; the block screen links to both and includes a community search.
- **Only show allowed communities** — every community not on your list disappears from the home feed. Community pages you open directly are not affected.
- **Allowed communities** — build the list without guessing names:
  - **Search** a topic and click **＋ Allow** on real communities (correct spelling guaranteed — they come from Reddit itself), or
  - type names one per line (with or without `r/`) and click **Verify names** — each one is checked against Reddit, capitalization is fixed, and typos are flagged in red.

### Filters — words, adult content, themes

- **Keywords** — flip **Hide posts with these keywords** on, edit the list (one word or phrase per line), and **Save keywords**. **Whole-word match only** reduces false hits (stops "war" matching "warm").
- **Adult content** — **Block all adult content** hides 18+ posts and blocks 18+ community pages (on by default). **Lock this on** makes it permanent: it can't be re-enabled from the popup, and only uninstalling the extension removes it.
- **Themes** — define a *theme* as a few **concepts** (each a short list of seed words). A post is blocked when a majority of the concepts appear together, so you catch a whole topic without listing every phrasing. Tune how many concepts must connect, preview matches with the **Test it** box, and **Save themes**. Ships with an editable starter theme.

### Media — images

- **Blur nude or explicit images** — on-device AI; the ~7 MB model loads once on first use. Optionally also blur "revealing" images, and tune the sensitivity slider.
- **Read text inside images** — OCR for screenshots and memes, run through your keyword and theme filters. Off by default; it's slow, so it processes one image at a time.

### Discover — find & block communities

- Type an interest and press **Find communities** — top results plus related topics, each with a **Block** button.
- Your **blocked communities** appear at the top as chips, each with an un-block **×**.

### On Reddit itself

- A floating **🚫 Block r/…** button appears on every community page. One click blocks it everywhere.
- Hidden posts show a small "🚫 Hidden" bar. Keyword matches offer **Show anyway**; adult content, blocked communities and theme matches are hard-hidden with no reveal.

---

## 🔒 Privacy

- **No external servers.** Keyword/theme filtering, image classification and OCR all run entirely in your browser.
- The community finder and NSFW checks talk **only to Reddit's own API**, using your existing session.
- Settings live in Chrome's extension storage and sync only through your own browser profile.
- No analytics, no telemetry, no accounts.

---

## ❓ FAQ

**Does it work on old Reddit?**
Yes — both new Reddit (`www.reddit.com`) and `old.reddit.com` are supported.

**Will blocking the home feed break chat or notifications?**
No, by design. Chat (`chat.reddit.com`, including chat requests) and notifications are explicitly exempt from every block this extension applies.

**A post slipped through — why?**
Keyword matching is text-based: if the post's text doesn't contain a listed word, it won't match. Add the missing word, create a theme for the topic, or enable OCR if the text lives inside an image.

**Can my settings move to another computer?**
Yes — **Backup → Export** writes everything to a JSON file you can **Import** elsewhere. Chrome sync also carries settings between browsers where you're signed in.

**Is the adult-content lock really permanent?**
It can't be turned off from the popup once locked. Uninstalling the extension is the only way to remove it — no browser extension can prevent that.

---

## 🗂️ Project structure

```
manifest.json      Extension config (Manifest V3)
content.js         Filtering, home-feed allowlist/block, NSFW & community blocking, finder, OCR pipeline
content.css        Styles for hidden posts, block screens, block button
popup.html/js      Toolbar popup (Home / Filters / Media / Discover tabs + backup)
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

- Manifest V3 · vanilla JS · no build step
- [TensorFlow.js](https://www.tensorflow.org/js) + [NSFWJS](https://github.com/infinitered/nsfwjs) — on-device image classification
- [Tesseract.js](https://tesseract.projectnaptha.com/) — on-device OCR, hosted in an offscreen document
- Reddit's public JSON API — NSFW flags, community search & verification
