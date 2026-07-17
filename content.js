/* Reddit Positivity Filter — content script
 * 1) Hides posts/comments that mention filtered (negative/vulgar) topics.
 * 2) Fetches recommended communities for a keyword (same-origin, uses your session).
 */

const DEFAULTS = {
  enabled: true,
  strict: false, // false = also match variants (murder -> murders, murdered)
  hideNsfw: true,    // hide posts/communities Reddit itself flags as adult/NSFW
  nsfwLocked: false, // once true, adult blocking is forced on and can't be toggled off in the popup
  imgFilter: true,        // AI image blurring (loads a ~7MB model on first use)
  imgIncludeSexy: false,  // also blur "revealing / short-dress" (broader, more false positives)
  imgSensitivity: 60,     // 1..100, higher = stricter
  ocrEnabled: false,      // read text inside images (OCR) and run it through keyword + theme filters
  hiddenSubs: [],         // communities blocked with × (hidden in feeds + page blocked + not recommended)
  allowMode: false,       // home feed: only posts from allowedSubs are shown
  allowedSubs: [],        // communities allowed on the home feed when allowMode is on
  homeBlock: false,       // block the home feed entirely (chat + notifications keep working)
  themesEnabled: true,    // master switch for concept-connection "theme" filters
  themes: [],             // concept-group theme filters (see THEME_STARTER); seeded on first run
  keywords: [
    // Violence / crime
    "murder", "kill", "homicide", "manslaughter", "stab", "shooting", "massacre",
    "genocide", "terrorist", "terrorism", "bombing", "assault", "abuse", "torture",
    "mutilat", "gore", "beheading", "lynch", "suicide", "self-harm", "self harm",
    "overdose", "kidnap", "arson",
    // Sexual violence
    "rape", "molest", "pedophile", "pedo", "incest", "groom",
    // Cheating / infidelity
    "cheating", "cheater", "infidelity", "affair", "unfaithful", "adultery", "cuckold",
    // Vulgar / profanity / slurs
    "fuck", "shit", "bitch", "cunt", "dick", "cock", "pussy", "slut", "whore",
    "bastard", "asshole", "motherfucker", "retard", "nigger", "faggot",
    // Sexual / NSFW
    "porn", "nsfw", "nude", "blowjob", "handjob", "masturbat", "hentai",
    "onlyfans", "escort", "dildo",
    // Film industry / celebrity (Bollywood, Hollywood, etc.)
    "bollywood", "hollywood", "tollywood", "kollywood", "film industry",
    "film", "movie", "cinema", "filmmaker", "box office", "celebrity",
    "celebrities", "actor", "actress", "red carpet", "oscars", "film festival",
    // Warfare / armed conflict (specific terms — avoids matching "warm"/"warning")
    "warfare", "civil war", "world war", "nuclear war", "war crime", "warzone",
    "war zone", "invasion", "airstrike", "air strike", "missile", "artillery",
    "bombardment", "military conflict", "armed conflict", "troops", "combat",
    "insurgency", "militia", "guerrilla", "ceasefire", "battlefield",
    "frontline", "front line", "soldier", "drone strike"
  ]
};

// Starter theme, seeded once so the concept-connection filter works on install.
// A "theme" blocks a post when a majority of its concept groups appear together.
const THEME_STARTER = [
  {
    name: "Example: safety · women · country · laws",
    enabled: true,
    minGroups: 3, // block when >= 3 of the 4 concepts connect
    groups: [
      { name: "Safe",    words: ["safe", "safety", "secure", "security", "protection", "protect", "unsafe"] },
      { name: "Women",   words: ["women", "woman", "girl", "girls", "female", "females", "ladies", "lady"] },
      { name: "Country", words: ["country", "nation", "national", "state", "government", "govt"] },
      { name: "Laws",    words: ["law", "laws", "legal", "act", "bill", "policy", "rights", "court"] }
    ]
  }
];

// Related-topic map so a search expands into synonym / adjacent communities.
const RELATED = {
  "machine learning": ["data science", "deep learning", "artificial intelligence", "statistics", "computer vision", "natural language processing", "neural networks"],
  "data science": ["machine learning", "statistics", "data analysis", "python", "big data", "data engineering"],
  "artificial intelligence": ["machine learning", "deep learning", "data science", "chatgpt", "robotics"],
  "deep learning": ["machine learning", "neural networks", "artificial intelligence", "computer vision"],
  "programming": ["coding", "software engineering", "python", "javascript", "webdev", "computer science"],
  "web development": ["webdev", "javascript", "frontend", "backend", "css", "react"],
  "gaming": ["games", "pc gaming", "gamers", "esports"],
  "fitness": ["gym", "bodybuilding", "workout", "nutrition", "running", "weightlifting"],
  "finance": ["investing", "stocks", "personal finance", "economics", "financial independence"],
  "photography": ["photos", "cameras", "photocritique", "postprocessing"],
  "cooking": ["food", "recipes", "baking", "mealprep", "cookingforbeginners"],
  "cybersecurity": ["netsec", "hacking", "infosec", "privacy", "security"],
  "space": ["astronomy", "spacex", "nasa", "cosmology", "astrophotography"]
};

let cfg = { ...DEFAULTS };
let matcher = null;
let compiledThemes = []; // [{ name, minGroups, groups: [{ name, re }] }]

const SEL = "shreddit-post, shreddit-comment, .thing.link, .thing.comment";

function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

function buildMatcher() {
  const words = (cfg.keywords || []).map(w => w.trim().toLowerCase()).filter(Boolean);
  if (!words.length) { matcher = null; return; }
  const body = words.map(escapeRe).join("|");
  matcher = new RegExp("\\b(" + body + ")" + (cfg.strict ? "\\b" : ""), "i");
}

// A "theme" fires when a majority of its concept groups are present in one post.
// Each group is a set of seed words; a group is "hit" if any of its words appears.
// Respects the same strict/whole-word toggle as the keyword filter.
function groupRegex(words) {
  const clean = (words || []).map(w => String(w).trim().toLowerCase()).filter(Boolean);
  if (!clean.length) return null;
  const body = clean.map(escapeRe).join("|");
  return new RegExp("\\b(" + body + ")" + (cfg.strict ? "\\b" : ""), "i");
}

// Majority of N groups = more than half (4->3, 3->2, 2->2). User can override.
function majorityOf(n) { return Math.floor(n / 2) + 1; }

function buildThemes() {
  compiledThemes = [];
  if (cfg.themesEnabled === false) return;
  (cfg.themes || []).forEach(t => {
    if (!t || t.enabled === false) return;
    const groups = (t.groups || [])
      .map(g => ({ name: g.name || "", re: groupRegex(g.words) }))
      .filter(g => g.re);
    if (groups.length < 2) return; // a "connection" needs at least two concepts
    const maj = majorityOf(groups.length);
    let need = Number.isFinite(t.minGroups) ? t.minGroups : maj;
    need = Math.max(2, Math.min(groups.length, need));
    compiledThemes.push({ name: t.name || "theme", minGroups: need, groups });
  });
}

// Returns { hit, need, groupsHit:[names] } for a compiled theme against text.
function matchTheme(text, theme) {
  const groupsHit = [];
  for (const g of theme.groups) {
    if (g.re.test(text)) groupsHit.push(g.name || "concept");
  }
  return { hit: groupsHit.length >= theme.minGroups, need: theme.minGroups, groupsHit };
}

function textOf(el) {
  let t = "";
  if (el.getAttribute) {
    t = (el.getAttribute("post-title") || el.getAttribute("aria-label") || "") + " ";
  }
  return (t + (el.textContent || "")).toLowerCase();
}

function cardFor(el) {
  const art = el.closest ? el.closest("article") : null;
  return art || el;
}

// revealable=false → adult/NSFW & blocked communities: hard-hide, no "Show anyway".
function hideEl(el, word, revealable = true) {
  if (el.dataset.rpfHidden) return;
  el.dataset.rpfHidden = "1";
  const card = cardFor(el);
  card.classList.add("rpf-hidden");

  const ph = document.createElement("div");
  ph.className = "rpf-placeholder";
  const span = document.createElement("span");
  span.textContent = "🚫 Hidden — " + word + ".";
  ph.appendChild(span);
  if (revealable) {
    const btn = document.createElement("button");
    btn.className = "rpf-show";
    btn.textContent = "Show anyway";
    btn.addEventListener("click", () => {
      card.classList.remove("rpf-hidden");
      ph.remove();
    });
    ph.appendChild(btn);
  }
  if (card.parentNode) card.parentNode.insertBefore(ph, card);
}

// New Reddit exposes NO nsfw attribute in the DOM, so we confirm each post's
// adult status against Reddit's own API (over_18) and hide flagged posts.
// Old Reddit *does* expose `.over18` as a class, handled synchronously below.
const nsfwCache = new Map();  // "t3_xxx" -> boolean
const nsfwElems = new Map();  // "t3_xxx" -> element awaiting a result
let nsfwPending = new Set();
let nsfwTimer = null;

function queueNsfwCheck(el) {
  const id = el.id;
  if (!id || !/^t3_/.test(id)) return;
  if (nsfwCache.has(id)) {
    if (nsfwCache.get(id)) hideEl(el, "adult / NSFW content", false);
    return;
  }
  nsfwElems.set(id, el);
  nsfwPending.add(id);
  if (!nsfwTimer) nsfwTimer = setTimeout(flushNsfw, 350);
}

async function flushNsfw() {
  nsfwTimer = null;
  const ids = [...nsfwPending];
  nsfwPending.clear();
  for (let i = 0; i < ids.length; i += 100) {
    const batch = ids.slice(i, i + 100);
    const j = await fetchJson(
      "https://www.reddit.com/api/info.json?id=" + batch.join(",") + "&raw_json=1");
    const kids = (j && j.data && j.data.children) || [];
    kids.forEach(c => {
      const name = c.data.name;
      const over = !!c.data.over_18;
      nsfwCache.set(name, over);
      const el = nsfwElems.get(name);
      if (over && el) hideEl(el, "adult / NSFW content", false);
      nsfwElems.delete(name);
    });
  }
}

// Communities the user blocked with the × ("hide") button on a recommendation.
let blockedSubs = new Set();
function buildBlocked() {
  blockedSubs = new Set((cfg.hiddenSubs || []).map(s => String(s).toLowerCase()));
}

// Home-feed allowlist: when on, ONLY these communities may appear on the home
// feed — every other community's posts are removed (no placeholder).
let allowedSubs = new Set();
function buildAllowed() {
  allowedSubs = new Set(
    (cfg.allowedSubs || [])
      .map(s => String(s).trim().replace(/^\/?r\//i, "").toLowerCase())
      .filter(Boolean)
  );
}

function allowModeActive() {
  return !!cfg.allowMode && allowedSubs.size > 0;
}

// The home feed = reddit.com root and its sort variants (new + old Reddit).
// Community pages, search, profiles etc. are untouched by the allowlist.
// The hostname guard matters: chat.reddit.com's path is also "/" — chat and
// chat requests must NEVER be treated as the home feed (nor mod./ads. tools).
function isHomeFeed() {
  if (!/^(www\.|old\.|new\.)?reddit\.com$/i.test(location.hostname)) return false;
  const p = location.pathname.replace(/\/+$/, "") || "/";
  return p === "/" || /^\/(best|hot|new|rising|top|controversial)$/i.test(p);
}

// Remove a post outright — a home feed 90% made of placeholders would be noise.
function hideSilently(el) {
  if (el.dataset.rpfHidden) return;
  el.dataset.rpfHidden = "1";
  cardFor(el).classList.add("rpf-hidden");
}

function subredditOf(el) {
  if (!el.getAttribute) return "";
  const n = el.getAttribute("subreddit-name") ||       // new reddit
            el.getAttribute("data-subreddit") || "";   // old reddit
  return n.toLowerCase();
}

// Full-page block for adult communities *and* communities you blocked with ×.
const subGateCache = new Map(); // "subname" -> boolean(over18)

async function checkSubredditGate() {
  removeBlock(); // clear any stale block when navigating
  if (cfg.homeBlock && isHomeFeed()) { blockHomePage(); return; }
  const m = location.pathname.match(/^\/r\/([A-Za-z0-9_]+)/);
  if (!m) return;
  const sub = m[1].toLowerCase();
  if (sub === "all" || sub === "popular") return;

  if (blockedSubs.has(sub)) { blockPage(sub, "blocked"); return; }
  if (!cfg.hideNsfw) return;

  let over = subGateCache.get(sub);
  if (over === undefined) {
    const j = await fetchJson("https://www.reddit.com/r/" + sub + "/about.json?raw_json=1");
    over = !!(j && j.data && (j.data.over18 || j.data.over_18));
    subGateCache.set(sub, over);
  }
  // guard against a late response after the user already navigated away
  if (over && new RegExp("^/r/" + sub + "(/|$)", "i").test(location.pathname)) blockPage(sub, "nsfw");
}

function blockPage(sub, kind) {
  if (document.getElementById("rpf-block")) return;
  const heading = kind === "nsfw" ? "Adult community blocked" : "Community blocked";
  const reason = kind === "nsfw"
    ? "r/" + sub + " is flagged 18+/NSFW. Viewing and joining it are blocked by your Positivity Filter."
    : "You blocked r/" + sub + ". Viewing and joining it are turned off. Un-block it from the extension's Find-communities tab.";
  const div = document.createElement("div");
  div.id = "rpf-block";
  div.innerHTML =
    '<div class="rpf-block-card">' +
    '<div class="rpf-block-emoji">🔒</div>' +
    '<h2>' + heading + '</h2>' +
    '<p>' + reason + '</p>' +
    '<a class="rpf-block-btn" href="https://www.reddit.com/">Go to a safe feed</a>' +
    '</div>';
  document.documentElement.appendChild(div);
  document.documentElement.style.overflow = "hidden";
}

// Full-screen block for the home feed. Deliberately NOT a dead end: chat
// (including chat requests, which live on chat.reddit.com), notifications and
// community search all keep working — only the feed itself is off.
function fmtSubCount(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(0) + "k";
  return String(n || 0);
}

function blockHomePage() {
  if (document.getElementById("rpf-block")) return;
  const div = document.createElement("div");
  div.id = "rpf-block";
  div.innerHTML =
    '<div class="rpf-block-card">' +
    '<div class="rpf-block-emoji">🏡</div>' +
    '<h2>Home feed blocked</h2>' +
    '<p>You turned the Reddit home feed off. You can still search communities, chat and read notifications.</p>' +
    '<div class="rpf-block-search">' +
    '<input id="rpf-search-in" type="text" placeholder="Search communities…" maxlength="80" />' +
    '<button id="rpf-search-btn" type="button">Search</button>' +
    '</div>' +
    '<div id="rpf-search-results"></div>' +
    '<div class="rpf-block-actions">' +
    '<a class="rpf-block-btn" href="https://chat.reddit.com/">💬 Open chat</a>' +
    '<a class="rpf-block-btn rpf-block-btn2" href="https://www.reddit.com/notifications">🔔 Notifications</a>' +
    '</div>' +
    '<p class="rpf-block-note">Turn this off from the extension popup any time.</p>' +
    '</div>';
  document.documentElement.appendChild(div);
  document.documentElement.style.overflow = "hidden";

  // Search runs through the same recommender as the popup's finder, so blocked
  // and 18+ communities never show up. Opening a community page is fine — the
  // block covers only the home feed.
  const input = div.querySelector("#rpf-search-in");
  const btn = div.querySelector("#rpf-search-btn");
  const out = div.querySelector("#rpf-search-results");
  let searching = false;
  async function go() {
    const q = input.value.trim();
    if (!q || searching) return;
    searching = true;
    out.textContent = "";
    const p = document.createElement("p");
    p.className = "rpf-muted";
    p.textContent = "Searching…";
    out.appendChild(p);
    const res = await recommend(q).catch(() => null);
    searching = false;
    const list = (res && res.list) || [];
    out.textContent = "";
    if (!list.length) {
      const none = document.createElement("p");
      none.className = "rpf-muted";
      none.textContent = "No communities found. Try a different term.";
      out.appendChild(none);
      return;
    }
    list.slice(0, 8).forEach(s => {
      const a = document.createElement("a");
      a.className = "rpf-sr";
      a.href = s.url;
      const name = document.createElement("span");
      name.className = "rpf-sr-name";
      name.textContent = "r/" + s.name;
      const subs = document.createElement("span");
      subs.className = "rpf-sr-subs";
      subs.textContent = fmtSubCount(s.subs) + " members";
      a.appendChild(name);
      a.appendChild(subs);
      out.appendChild(a);
    });
  }
  btn.addEventListener("click", go);
  input.addEventListener("keydown", e => { if (e.key === "Enter") go(); });
  input.focus();
}

// The subreddit currently being viewed (null on home / all / popular / non-sub pages).
function currentSub() {
  const m = location.pathname.match(/^\/r\/([A-Za-z0-9_]+)/);
  if (!m) return null;
  const low = m[1].toLowerCase();
  if (low === "all" || low === "popular") return null;
  return m[1]; // keep display casing for the label
}

// A floating "Block this community" button injected onto every subreddit page.
function updateBlockButton() {
  const sub = currentSub();
  let btn = document.getElementById("rpf-block-btn");
  if (!sub || blockedSubs.has(sub.toLowerCase())) {
    if (btn) btn.remove();
    return;
  }
  if (!btn) {
    btn = document.createElement("button");
    btn.id = "rpf-block-btn";
    btn.addEventListener("click", () => {
      const s = currentSub();
      if (!s) return;
      chrome.storage.sync.get({ hiddenSubs: [] }, v => {
        const set = new Set(v.hiddenSubs || []);
        set.add(s);
        chrome.storage.sync.set({ hiddenSubs: [...set] }); // triggers block via storage.onChanged
      });
    });
    document.body.appendChild(btn);
  }
  btn.textContent = "🚫 Block r/" + sub;
}

function removeBlock() {
  const b = document.getElementById("rpf-block");
  if (b) b.remove();
  document.documentElement.style.overflow = "";
}

function processOne(el) {
  if (!el.dataset || el.dataset.rpfSeen) return;
  el.dataset.rpfSeen = "1";
  if (allowModeActive() && isHomeFeed()) {
    const sub = subredditOf(el);
    // Only posts carry a subreddit attribute; anything without one is left alone.
    if (sub && !allowedSubs.has(sub)) { hideSilently(el); return; }
  }
  if (blockedSubs.size) {
    const sub = subredditOf(el);
    if (sub && blockedSubs.has(sub)) { hideEl(el, "blocked community r/" + sub, false); return; }
  }
  if (cfg.hideNsfw) {
    if (el.classList && el.classList.contains("over18")) { // old reddit
      hideEl(el, "adult / NSFW content", false);
      return;
    }
    if (el.tagName === "SHREDDIT-POST") queueNsfwCheck(el); // new reddit -> API
  }
  if (cfg.enabled && matcher) {
    const m = matcher.exec(textOf(el));
    if (m) { hideEl(el, 'mentions "' + m[1] + '"'); return; }
  }
  if (compiledThemes.length) {
    const txt = textOf(el);
    for (const t of compiledThemes) {
      const r = matchTheme(txt, t);
      if (r.hit) {
        // Hard-hide (no "Show anyway"): the user asked for these to be blocked/banned.
        hideEl(el, 'theme "' + t.name + '" (' + r.groupsHit.join(" + ") + ')', false);
        return;
      }
    }
  }
}

function filteringActive() {
  return cfg.hideNsfw || blockedSubs.size > 0 || (cfg.enabled && matcher) ||
         compiledThemes.length > 0 || (allowModeActive() && isHomeFeed());
}

function scan(root) {
  if (!filteringActive()) return;
  if (root.nodeType === 1 && root.matches && root.matches(SEL)) processOne(root);
  const nodes = root.querySelectorAll ? root.querySelectorAll(SEL) : [];
  nodes.forEach(processOne);
}

function unhideAll() {
  document.querySelectorAll(".rpf-placeholder").forEach(n => n.remove());
  document.querySelectorAll(".rpf-hidden").forEach(n => n.classList.remove("rpf-hidden"));
  document.querySelectorAll("[data-rpf-seen]").forEach(n => {
    delete n.dataset.rpfSeen;
    delete n.dataset.rpfHidden;
  });
}

function applyAll() {
  buildMatcher();
  buildThemes();
  buildBlocked();
  buildAllowed();
  unhideAll();
  scan(document); // scan() checks its own gates (keyword + NSFW + blocked subs)
}

// ---- Community recommender (runs same-origin on reddit.com) ----
async function fetchJson(url) {
  try {
    const r = await fetch(url, { credentials: "include", headers: { Accept: "application/json" } });
    if (!r.ok) return null;
    return await r.json();
  } catch (e) { return null; }
}

async function recommend(query) {
  const q = (query || "").trim().toLowerCase();
  if (!q) return { ok: false, error: "Empty query", list: [] };

  const words = q.split(/\s+/).filter(w => w.length > 2);
  const related = RELATED[q] || [];
  const byName = new Map();

  // Communities the user permanently dismissed with the × button.
  const hiddenSet = await new Promise(resolve =>
    chrome.storage.sync.get({ hiddenSubs: [] }, v =>
      resolve(new Set((v.hiddenSubs || []).map(s => String(s).toLowerCase())))));

  // Blend relevance (rank in Reddit's own ordering) with popularity and how
  // well the community's name/description matches the query words.
  function add(d, weight, rank) {
    if (!d || d.over18) return;
    const name = d.display_name;
    if (!name || /^u_/i.test(name)) return;   // skip user profiles
    if (d.subreddit_type === "private") return;
    if (hiddenSet.has(name.toLowerCase())) return; // user dismissed this one
    const subs = d.subscribers || 0;

    const rel = weight / (rank + 1);                 // earlier = more relevant
    const pop = Math.log10(subs + 10);               // gentle popularity nudge
    const hay = (name + " " + (d.title || "") + " " + (d.public_description || "")).toLowerCase();
    let textMatch = 0;
    words.forEach(w => { if (hay.includes(w)) textMatch += 1; });
    if (name.toLowerCase().replace(/[^a-z]/g, "").includes(q.replace(/[^a-z]/g, ""))) textMatch += 2;

    const base = rel * 10 + pop + textMatch * 3;
    const ex = byName.get(name);
    if (ex) {
      // showing up under multiple related terms is a strong relevance signal
      ex.score = Math.max(ex.score, base) + rel * 4;
    } else {
      byName.set(name, {
        name,
        title: d.title || "",
        subs,
        url: "https://www.reddit.com/r/" + name + "/",
        desc: (d.public_description || "").slice(0, 140),
        score: base
      });
    }
  }

  // Two complementary endpoints: autocomplete is topical/name-aware,
  // subreddits/search is relevance-ranked. Word-splitting is intentionally gone.
  async function pull(term, weight) {
    const ac = await fetchJson(
      "https://www.reddit.com/api/subreddit_autocomplete_v2?query=" +
      encodeURIComponent(term) +
      "&include_over_18=false&include_profiles=false&limit=10&raw_json=1"
    );
    ((ac && ac.data && ac.data.children) || []).forEach((c, i) => add(c.data, weight, i));

    const sr = await fetchJson(
      "https://www.reddit.com/subreddits/search.json?q=" +
      encodeURIComponent(term) + "&sort=relevance&limit=15&include_over_18=off&raw_json=1"
    );
    ((sr && sr.data && sr.data.children) || []).forEach((c, i) => add(c.data, weight, i));
  }

  await pull(q, 3);                                            // primary topic
  await Promise.allSettled(related.slice(0, 6).map(t => pull(t, 1))); // related topics

  const all = [...byName.values()].sort((a, b) => b.score - a.score);
  // Prefer real, active communities; relax if that leaves too few.
  let list = all.filter(s => s.subs >= 200).slice(0, 20);
  if (list.length < 8) list = all.slice(0, 20);
  return { ok: true, list };
}

chrome.runtime.onMessage.addListener((msg, sender, send) => {
  if (msg && msg.type === "recommend") {
    recommend(msg.query).then(send);
    return true; // async response
  }
});

// ---- On-device explicit-image filter (NSFWJS / TensorFlow.js) ----
// Everything runs locally in the page; no image ever leaves the browser.
let modelPromise = null;
async function ensureModel() {
  if (modelPromise) return modelPromise;
  modelPromise = (async () => {
    // Lazy-load the ~7MB library + weights only when the user turns this on.
    await import(chrome.runtime.getURL("vendor/tf.js"));
    await import(chrome.runtime.getURL("vendor/nsfwjs.js"));
    const tf = globalThis.tf;
    const nsfwjs = globalThis.nsfwjs;
    if (tf.enableProdMode) tf.enableProdMode();
    // Trailing slash: nsfwjs fetches <base>model.json (a Keras "layers" model).
    const model = await nsfwjs.load(chrome.runtime.getURL("model/"), { size: 224 });
    return model;
  })().catch(err => { modelPromise = null; throw err; });
  return modelPromise;
}

function loadCorsImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous"; // needed so the model can read pixels
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("cors/load"));
    img.src = url;
  });
}

function scoreOf(preds) {
  let porn = 0, hentai = 0, sexy = 0;
  preds.forEach(p => {
    if (p.className === "Porn") porn = p.probability;
    else if (p.className === "Hentai") hentai = p.probability;
    else if (p.className === "Sexy") sexy = p.probability;
  });
  return { explicit: Math.max(porn, hentai), sexy };
}

function blurImage(img, reason) {
  if (img.dataset.rpfBlur) return;
  img.dataset.rpfBlur = "1";
  img.style.filter = "blur(32px)";
  img.style.transition = "filter .15s ease";
  const parent = img.parentElement;
  if (!parent) return;
  if (getComputedStyle(parent).position === "static") parent.style.position = "relative";
  const ov = document.createElement("button");
  ov.className = "rpf-img-overlay";
  ov.textContent = "🔞 " + reason + " — click to view";
  ov.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    img.style.filter = "";
    ov.remove();
  });
  parent.appendChild(ov);
}

// Small concurrency-limited queue so scrolling doesn't spawn 100 classifications.
const imgQueue = [];
let active = 0;
const MAX_ACTIVE = 2;

function isTiny(img) {
  const w = img.clientWidth || img.naturalWidth || 0;
  const h = img.clientHeight || img.naturalHeight || 0;
  return (w && w < 90) || (h && h < 90);
}

function pump() {
  while (active < MAX_ACTIVE && imgQueue.length) {
    const { img, src } = imgQueue.shift();
    active++;
    classifyImg(img, src).catch(() => {}).finally(() => { active--; pump(); });
  }
}

async function classifyImg(img, src) {
  const model = await ensureModel();
  const el = await loadCorsImage(src); // fresh, untainted element for pixel reads
  const preds = await model.classify(el);
  const { explicit, sexy } = scoreOf(preds);
  const s = (cfg.imgSensitivity || 60) / 100;
  const tExplicit = 0.85 - s * 0.45; // sensitivity 100 -> 0.40, 60 -> 0.58, 1 -> ~0.85
  const tSexy = 0.90 - s * 0.40;
  if (explicit >= tExplicit) blurImage(img, "Explicit image hidden");
  else if (cfg.imgIncludeSexy && sexy >= tSexy) blurImage(img, "Revealing image hidden");
}

function scanImages(root) {
  if (!cfg.imgFilter) return;
  const imgs = root.querySelectorAll ? root.querySelectorAll("img") : [];
  imgs.forEach(img => {
    if (img.dataset.rpfImgSeen) return;
    const src = img.currentSrc || img.src || "";
    // Only Reddit-hosted images are CORS-readable; skip avatars/icons/emoji.
    if (!/(^|\.)redd\.it\//.test(src) && !/\.reddit(static)?\.com\//.test(src)) return;
    if (/\/(award|emoji|avatar)/i.test(src) || /styles\.redditmedia/.test(src)) return;
    if (isTiny(img)) return;
    img.dataset.rpfImgSeen = "1";
    imgQueue.push({ img, src });
  });
  pump();
}

// ---- On-device OCR (Tesseract.js, via the offscreen document) ----
// Reads text baked into images and runs it through the SAME keyword + theme
// filters as normal post text. OCR is heavy, so it's opt-in and one-at-a-time.
const ocrQueue = [];
let ocrActive = 0;
const OCR_MAX = 1;                 // OCR is expensive — never run two at once
const ocrCache = new Map();        // src -> recognized text (avoids re-OCR on re-scan)

// Only worth OCR-ing if there's actually a text/theme rule to test against.
function ocrUseful() {
  return cfg.ocrEnabled && (((cfg.enabled && matcher)) || compiledThemes.length > 0);
}

function postCardOf(img) {
  return (img.closest && img.closest("shreddit-post, .thing.link, article")) || img;
}

function scanOcr(root) {
  if (!ocrUseful()) return;
  const imgs = root.querySelectorAll ? root.querySelectorAll("img") : [];
  imgs.forEach(img => {
    if (img.dataset.rpfOcrSeen) return;
    const src = img.currentSrc || img.src || "";
    // Same CORS-readable constraint as the NSFW filter: only Reddit-hosted images.
    if (!/(^|\.)redd\.it\//.test(src) && !/\.reddit(static)?\.com\//.test(src)) return;
    if (/\/(award|emoji|avatar)/i.test(src) || /styles\.redditmedia/.test(src)) return;
    if (isTiny(img)) return;
    img.dataset.rpfOcrSeen = "1";
    ocrQueue.push({ img, src });
  });
  pumpOcr();
}

function pumpOcr() {
  while (ocrActive < OCR_MAX && ocrQueue.length) {
    const { img, src } = ocrQueue.shift();
    ocrActive++;
    ocrOne(img, src).catch(() => {}).finally(() => { ocrActive--; pumpOcr(); });
  }
}

async function ocrText(src) {
  if (ocrCache.has(src)) return ocrCache.get(src);
  const el = await loadCorsImage(src);         // untainted element for pixel reads
  const canvas = document.createElement("canvas");
  const maxW = 1000;                            // downscale huge images for speed
  const scale = el.naturalWidth > maxW ? maxW / el.naturalWidth : 1;
  canvas.width = Math.max(1, Math.round(el.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(el.naturalHeight * scale));
  canvas.getContext("2d").drawImage(el, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL("image/png");
  const res = await chrome.runtime.sendMessage({ type: "ocr-request", dataUrl });
  const text = (res && res.ok && res.text) ? res.text : "";
  ocrCache.set(src, text);
  return text;
}

async function ocrOne(img, src) {
  const text = await ocrText(src);
  if (!text || !text.trim()) return;
  const low = text.toLowerCase();
  const card = postCardOf(img);
  // Keyword hit -> revealable ("Show anyway"); theme hit -> hard-block.
  if (cfg.enabled && matcher) {
    const m = matcher.exec(low);
    if (m) { hideEl(card, 'image text mentions "' + m[1] + '"', true); return; }
  }
  for (const t of compiledThemes) {
    const r = matchTheme(low, t);
    if (r.hit) { hideEl(card, 'image theme "' + t.name + '" (' + r.groupsHit.join(" + ") + ')', false); return; }
  }
}

// A lock is a one-way commitment: once set, adult blocking stays on.
function applyLock() {
  if (cfg.nsfwLocked) cfg.hideNsfw = true;
}

// ---- Boot ----
// Seed the default keyword list into storage on first run so the popup and the
// export/import feature always see the real list (not an empty placeholder).
chrome.storage.sync.get(null, (raw) => {
  const patch = {};
  if (!raw || !Array.isArray(raw.keywords) || raw.keywords.length === 0) {
    patch.keywords = DEFAULTS.keywords;
  }
  // Seed the starter theme only if `themes` has never been set (an empty array
  // means the user deliberately cleared them — don't re-seed).
  if (!raw || raw.themes === undefined) {
    patch.themes = THEME_STARTER;
  }
  if (Object.keys(patch).length) chrome.storage.sync.set(patch);
});

chrome.storage.sync.get(DEFAULTS, (stored) => {
  cfg = { ...DEFAULTS, ...stored };
  applyLock();
  applyAll();
  scanImages(document);
  scanOcr(document);
  checkSubredditGate();
  updateBlockButton();

  const mo = new MutationObserver((muts) => {
    for (const m of muts) {
      for (const n of m.addedNodes) {
        if (n.nodeType !== 1) continue;
        if (filteringActive()) scan(n);
        if (cfg.imgFilter) scanImages(n);
        if (cfg.ocrEnabled) scanOcr(n);
      }
    }
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });

  // Reddit is a single-page app: the URL changes without a reload, so poll it
  // to re-check the adult-community gate when you move between communities.
  let lastPath = location.pathname;
  setInterval(() => {
    if (location.pathname !== lastPath) {
      lastPath = location.pathname;
      checkSubredditGate();
      updateBlockButton();
      // The allowlist only applies on the home feed, so entering/leaving it
      // must re-evaluate everything already on the page.
      if (allowModeActive()) applyAll();
    }
  }, 700);
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "sync") return;
  chrome.storage.sync.get(DEFAULTS, (stored) => {
    cfg = { ...DEFAULTS, ...stored };
    applyLock();
    applyAll();
    if (cfg.imgFilter) scanImages(document);
    if (cfg.ocrEnabled) scanOcr(document);
    checkSubredditGate();
    updateBlockButton();
  });
});
