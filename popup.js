const DEFAULTS = {
  enabled: true,
  strict: false,
  hideNsfw: true,
  nsfwLocked: false,
  imgFilter: true,
  imgIncludeSexy: false,
  imgSensitivity: 60,
  ocrEnabled: false,
  hiddenSubs: [],
  allowMode: false,
  allowedSubs: [],
  homeBlock: false,
  themesEnabled: true,
  themes: [], // concept-connection theme filters; real starter is seeded by content.js
  keywords: [] // real defaults live in content.js; popup fills from storage
};

// ---- Tab switching ----
document.querySelectorAll(".tab").forEach(t => {
  const activate = () => {
    document.querySelectorAll(".tab").forEach(x => x.classList.remove("active"));
    document.querySelectorAll(".panel").forEach(x => x.classList.remove("active"));
    t.classList.add("active");
    document.getElementById("panel-" + t.dataset.tab).classList.add("active");
  };
  t.addEventListener("click", activate);
  t.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); activate(); }
  });
});

// ---- Filter settings ----
const enabledEl = document.getElementById("enabled");
const strictEl = document.getElementById("strict");
const nsfwEl = document.getElementById("hideNsfw");
const lockBtn = document.getElementById("lockBtn");
const lockRow = document.getElementById("lockRow");
const lockedNote = document.getElementById("lockedNote");
const keywordsEl = document.getElementById("keywords");
let isLocked = false;

function reflectLock() {
  nsfwEl.checked = isLocked ? true : nsfwEl.checked;
  nsfwEl.disabled = isLocked;
  lockRow.style.display = isLocked ? "none" : "flex";
  lockedNote.style.display = isLocked ? "block" : "none";
}
const statusEl = document.getElementById("status");
const imgFilterEl = document.getElementById("imgFilter");
const imgSexyEl = document.getElementById("imgIncludeSexy");
const sensEl = document.getElementById("imgSensitivity");
const sensValEl = document.getElementById("sensVal");
const ocrEl = document.getElementById("ocrEnabled");
const allowModeEl = document.getElementById("allowMode");
const homeBlockEl = document.getElementById("homeBlock");
const allowedSubsEl = document.getElementById("allowedSubs");
const allowedStatusEl = document.getElementById("allowedStatus");

// Accept "r/Name", "/r/Name" or "Name", one per line (commas also work).
function parseAllowedSubs(str) {
  const seen = new Set();
  const out = [];
  String(str || "").split(/[,\n]/).forEach(s => {
    const name = s.trim().replace(/^\/?r\//i, "").replace(/\/+$/, "");
    if (!name || !/^[A-Za-z0-9_]+$/.test(name)) return;
    const low = name.toLowerCase();
    if (seen.has(low)) return;
    seen.add(low);
    out.push(name);
  });
  return out;
}

chrome.storage.sync.get(DEFAULTS, (s) => {
  enabledEl.checked = s.enabled !== false;
  strictEl.checked = !!s.strict;
  nsfwEl.checked = s.hideNsfw !== false;
  isLocked = !!s.nsfwLocked;
  reflectLock();
  imgFilterEl.checked = !!s.imgFilter;
  imgSexyEl.checked = !!s.imgIncludeSexy;
  sensEl.value = s.imgSensitivity || 60;
  sensValEl.textContent = sensEl.value;
  ocrEl.checked = !!s.ocrEnabled;
  allowModeEl.checked = !!s.allowMode;
  homeBlockEl.checked = !!s.homeBlock;
  allowedSubsEl.value = (s.allowedSubs || []).join("\n");
  // If storage has no keywords yet, leave placeholder blank; content.js seeds defaults.
  keywordsEl.value = (s.keywords && s.keywords.length) ? s.keywords.join("\n") : "";
  if (!s.keywords || !s.keywords.length) {
    keywordsEl.placeholder = "Default list is active. Type here to customize, then Save.";
  }
});

function flash(msg) {
  statusEl.textContent = msg;
  setTimeout(() => (statusEl.textContent = ""), 2500);
}

// Persist everything (keyword edits + all toggles/slider).
function saveAll(msg) {
  const keywords = keywordsEl.value.split("\n").map(w => w.trim()).filter(Boolean);
  const patch = {
    enabled: enabledEl.checked,
    strict: strictEl.checked,
    hideNsfw: isLocked ? true : nsfwEl.checked,
    imgFilter: imgFilterEl.checked,
    imgIncludeSexy: imgSexyEl.checked,
    imgSensitivity: parseInt(sensEl.value, 10) || 60,
    ocrEnabled: ocrEl.checked
  };
  if (keywords.length) patch.keywords = keywords; // keep defaults if textarea empty
  chrome.storage.sync.set(patch, () => { if (msg) flash(msg); });
}

// Toggles/slider apply immediately; keyword edits save on button click.
[enabledEl, strictEl, nsfwEl, imgFilterEl, imgSexyEl, ocrEl].forEach(el =>
  el.addEventListener("change", () => saveAll("Applied.")));
sensEl.addEventListener("input", () => { sensValEl.textContent = sensEl.value; });
sensEl.addEventListener("change", () => saveAll("Applied."));
document.getElementById("save").addEventListener("click", () =>
  saveAll("Saved. Reddit tabs update automatically."));

// ---- Home-feed allowlist ----
function allowedFlash(msg, ok) {
  allowedStatusEl.textContent = msg;
  allowedStatusEl.style.color = ok === false ? "var(--danger)" : "var(--ok)";
  setTimeout(() => (allowedStatusEl.textContent = ""), 3500);
}

function saveAllowed() {
  const subs = parseAllowedSubs(allowedSubsEl.value);
  chrome.storage.sync.set({ allowMode: allowModeEl.checked, allowedSubs: subs }, () => {
    allowedSubsEl.value = subs.join("\n");
    if (allowModeEl.checked && !subs.length) {
      allowedFlash("List is empty — add communities or the home feed stays unfiltered.", false);
    } else if (allowModeEl.checked) {
      allowedFlash("On — only " + subs.length + " communit" + (subs.length === 1 ? "y" : "ies") + " will show on the home feed.");
    } else {
      allowedFlash("Saved (allowlist is off).");
    }
  });
}

allowModeEl.addEventListener("change", saveAllowed);
document.getElementById("saveAllowed").addEventListener("click", saveAllowed);

homeBlockEl.addEventListener("change", () => {
  chrome.storage.sync.set({ homeBlock: homeBlockEl.checked }, () => {
    allowedFlash(homeBlockEl.checked
      ? "Home feed blocked. Chat & notifications still work."
      : "Home feed unblocked.");
  });
});

// ---- Allowlist community search (add real, verified communities) ----
const allowSearchEl = document.getElementById("allowSearch");
const allowResultsEl = document.getElementById("allowResults");

function currentAllowed() { return parseAllowedSubs(allowedSubsEl.value); }

// Names added via search come straight from Reddit's API, so they're
// verified-by-construction (correct casing included).
function addAllowedSub(name) {
  const subs = currentAllowed();
  if (!subs.some(s => s.toLowerCase() === name.toLowerCase())) subs.push(name);
  allowedSubsEl.value = subs.join("\n");
  chrome.storage.sync.set({ allowedSubs: subs }, () =>
    allowedFlash("Allowed r/" + name +
      (allowModeEl.checked ? "." : " — flip the allowlist switch on to activate it.")));
}

function renderAllowResults(list) {
  if (!list || !list.length) {
    allowResultsEl.innerHTML = '<p class="muted">No communities found. Try a different term.</p>';
    return;
  }
  const cur = new Set(currentAllowed().map(s => s.toLowerCase()));
  allowResultsEl.innerHTML = "";
  list.slice(0, 8).forEach(s => {
    const row = document.createElement("div");
    row.className = "sub-row";

    const a = document.createElement("a");
    a.className = "sub";
    a.href = s.url;
    a.target = "_blank";
    a.rel = "noopener";
    const top = document.createElement("span");
    top.className = "subtop";
    const name = document.createElement("span");
    name.className = "name";
    name.textContent = "r/" + s.name;
    const subs = document.createElement("span");
    subs.className = "subs";
    subs.textContent = fmtSubs(s.subs) + " members";
    top.appendChild(name);
    top.appendChild(subs);
    a.appendChild(top);
    if (s.desc) {
      const d = document.createElement("span");
      d.className = "desc";
      d.textContent = s.desc;
      a.appendChild(d);
    }

    const btn = document.createElement("button");
    btn.className = "allow-btn";
    if (cur.has(s.name.toLowerCase())) {
      btn.textContent = "✔ Allowed";
      btn.disabled = true;
    } else {
      btn.textContent = "＋ Allow";
      btn.title = "Add r/" + s.name + " to your home-feed allowlist";
      btn.addEventListener("click", () => {
        addAllowedSub(s.name);
        btn.textContent = "✔ Allowed";
        btn.disabled = true;
      });
    }

    row.appendChild(a);
    row.appendChild(btn);
    allowResultsEl.appendChild(row);
  });
}

async function allowFind() {
  const q = allowSearchEl.value.trim();
  if (!q) return;
  allowResultsEl.innerHTML = '<p class="muted">Searching…</p>';
  try {
    const res = await searchReddit(q);
    renderAllowResults(res && res.list);
  } catch (e) {
    allowResultsEl.innerHTML = '<p class="muted">Couldn\'t reach Reddit. Check your connection and try again.</p>';
  }
}
document.getElementById("allowFind").addEventListener("click", allowFind);
allowSearchEl.addEventListener("keydown", (e) => { if (e.key === "Enter") allowFind(); });

// Confirm every hand-typed community really exists (and fix its casing).
document.getElementById("verifyAllowed").addEventListener("click", async () => {
  const subs = currentAllowed();
  if (!subs.length) { allowedFlash("Nothing to verify — the list is empty.", false); return; }
  allowedFlash("Verifying " + subs.length + " communit" + (subs.length === 1 ? "y" : "ies") + "…");
  const checks = await Promise.allSettled(subs.map(async name => {
    const r = await fetch("https://www.reddit.com/r/" + encodeURIComponent(name) + "/about.json?raw_json=1",
      { headers: { Accept: "application/json" } });
    if (!r.ok) return { ok: false };
    const j = await r.json();
    const d = j && j.data;
    return (d && d.display_name) ? { ok: true, real: d.display_name } : { ok: false };
  }));
  if (checks.every(c => c.status === "rejected")) {
    allowedFlash("Couldn't reach Reddit — check your connection and try again.", false);
    return;
  }
  const bad = [];
  const fixed = subs.map((name, i) => {
    const c = checks[i].status === "fulfilled" ? checks[i].value : { ok: false };
    if (c.ok) return c.real;
    bad.push(name);
    return name; // keep it visible so the user can correct or delete it
  });
  allowedSubsEl.value = fixed.join("\n");
  chrome.storage.sync.set({ allowedSubs: parseAllowedSubs(allowedSubsEl.value) });
  if (bad.length) {
    allowedFlash("✖ Not found on Reddit: " + bad.map(n => "r/" + n).join(", ") + " — fix the spelling or remove.", false);
  } else {
    allowedFlash("✔ All " + subs.length + " communities exist. Saved.");
  }
});

lockBtn.addEventListener("click", () => {
  const ok = window.confirm(
    "Lock adult-content blocking ON?\n\n" +
    "You will NOT be able to turn it off from this popup afterwards. " +
    "The only way to remove it is to uninstall the extension in chrome://extensions.\n\n" +
    "Continue?");
  if (!ok) return;
  isLocked = true;
  nsfwEl.checked = true;
  chrome.storage.sync.set({ nsfwLocked: true, hideNsfw: true }, () => {
    reflectLock();
    flash("Locked on.");
  });
});

// ---- Theme filters (concept-connection blocking) ----
// Matching mirrors content.js so the live "Test it" box is accurate.
const themesEnabledEl = document.getElementById("themesEnabled");
const themesEl = document.getElementById("themes");
const themesStatusEl = document.getElementById("themesStatus");

function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function majorityOf(n) { return Math.floor(n / 2) + 1; }

function groupHit(words, text, strict) {
  const clean = (words || []).map(w => String(w).trim().toLowerCase()).filter(Boolean);
  if (!clean.length) return false;
  const re = new RegExp("\\b(" + clean.map(escapeRe).join("|") + ")" + (strict ? "\\b" : ""), "i");
  return re.test(text);
}

// Parse a "seed words" input (comma or newline separated) into an array.
function parseWords(str) {
  return String(str || "").split(/[,\n]/).map(w => w.trim()).filter(Boolean);
}

function makeGroupRow(name, words) {
  const row = document.createElement("div");
  row.className = "grp-row";
  const n = document.createElement("input");
  n.className = "grp-name";
  n.placeholder = "Concept";
  n.value = name || "";
  const w = document.createElement("input");
  w.className = "grp-words";
  w.placeholder = "seed words, comma-separated";
  w.value = (words || []).join(", ");
  const del = document.createElement("button");
  del.className = "grp-del";
  del.textContent = "×";
  del.title = "Remove concept";
  del.addEventListener("click", () => {
    const card = row.closest(".theme-card");
    row.remove();
    refreshCard(card);
  });
  [n, w].forEach(inp => inp.addEventListener("input", () => refreshCard(row.closest(".theme-card"))));
  row.appendChild(n); row.appendChild(w); row.appendChild(del);
  return row;
}

// Recompute the majority slider bounds + label and re-run the test box.
function refreshCard(card) {
  if (!card) return;
  const rows = card.querySelectorAll(".grp-row");
  const n = rows.length;
  const slider = card.querySelector(".theme-majslider");
  const total = card.querySelector(".theme-majtotal");
  const val = card.querySelector(".theme-majval");
  const min = Math.min(2, n) || 1;
  slider.min = String(min);
  slider.max = String(Math.max(min, n));
  if (parseInt(slider.value, 10) > n) slider.value = String(n);
  if (parseInt(slider.value, 10) < min) slider.value = String(min);
  val.textContent = slider.value;
  total.textContent = String(n);
  runTest(card);
}

function runTest(card) {
  const out = card.querySelector(".theme-testout");
  const text = (card.querySelector(".theme-testin").value || "").toLowerCase();
  if (!text.trim()) { out.textContent = ""; out.className = "theme-testout"; return; }
  const strict = strictEl.checked;
  const need = parseInt(card.querySelector(".theme-majslider").value, 10) || 2;
  const hitNames = [];
  card.querySelectorAll(".grp-row").forEach(row => {
    const nm = row.querySelector(".grp-name").value.trim() || "concept";
    const words = parseWords(row.querySelector(".grp-words").value);
    if (groupHit(words, text, strict)) hitNames.push(nm);
  });
  if (hitNames.length >= need) {
    out.className = "theme-testout block";
    out.textContent = "🚫 Would BLOCK — " + hitNames.length + "/" + need + " connected: " + hitNames.join(" + ");
  } else {
    out.className = "theme-testout allow";
    out.textContent = "✓ Would allow — only " + hitNames.length + "/" + need +
      (hitNames.length ? " (" + hitNames.join(", ") + ")" : "");
  }
}

function makeThemeCard(theme) {
  const t = theme || {};
  const card = document.createElement("div");
  card.className = "theme-card";

  const head = document.createElement("div");
  head.className = "theme-head";
  const name = document.createElement("input");
  name.className = "theme-name";
  name.placeholder = "Theme name";
  name.value = t.name || "";
  const enLabel = document.createElement("label");
  enLabel.className = "theme-en";
  const en = document.createElement("input");
  en.type = "checkbox";
  en.className = "theme-encheck";
  en.checked = t.enabled !== false;
  enLabel.appendChild(en);
  enLabel.appendChild(document.createTextNode("on"));
  const del = document.createElement("button");
  del.className = "theme-del";
  del.textContent = "×";
  del.title = "Delete theme";
  del.addEventListener("click", () => card.remove());
  head.appendChild(name); head.appendChild(enLabel); head.appendChild(del);
  card.appendChild(head);

  const groups = document.createElement("div");
  groups.className = "theme-groups";
  const initial = (t.groups && t.groups.length) ? t.groups : [{ name: "", words: [] }, { name: "", words: [] }];
  initial.forEach(g => groups.appendChild(makeGroupRow(g.name, g.words)));
  card.appendChild(groups);

  const addGrp = document.createElement("button");
  addGrp.className = "minibtn";
  addGrp.textContent = "+ concept";
  addGrp.style.fontSize = "11px";
  addGrp.style.padding = "4px 10px";
  addGrp.addEventListener("click", () => {
    groups.appendChild(makeGroupRow("", []));
    refreshCard(card);
  });
  card.appendChild(addGrp);

  const maj = document.createElement("div");
  maj.className = "theme-maj";
  maj.innerHTML = 'Block when <b class="theme-majval"></b> of <span class="theme-majtotal"></span> concepts connect';
  const slider = document.createElement("input");
  slider.type = "range";
  slider.className = "theme-majslider";
  slider.step = "1";
  const n = initial.length;
  slider.min = String(Math.min(2, n) || 1);
  slider.max = String(Math.max(2, n));
  slider.value = String(Number.isFinite(t.minGroups) ? t.minGroups : majorityOf(n));
  slider.addEventListener("input", () => refreshCard(card));
  card.appendChild(maj);
  card.appendChild(slider);

  const test = document.createElement("div");
  test.className = "theme-test";
  const testin = document.createElement("input");
  testin.className = "theme-testin";
  testin.placeholder = "Test it — paste post text here…";
  testin.addEventListener("input", () => runTest(card));
  const testout = document.createElement("div");
  testout.className = "theme-testout";
  test.appendChild(testin);
  test.appendChild(testout);
  card.appendChild(test);

  refreshCard(card);
  return card;
}

function renderThemes(themes) {
  themesEl.innerHTML = "";
  (themes || []).forEach(t => themesEl.appendChild(makeThemeCard(t)));
}

// Gather the editor UI back into a themes array for storage.
function collectThemes() {
  const out = [];
  themesEl.querySelectorAll(".theme-card").forEach(card => {
    const groups = [];
    card.querySelectorAll(".grp-row").forEach(row => {
      const words = parseWords(row.querySelector(".grp-words").value);
      if (!words.length) return;
      groups.push({ name: row.querySelector(".grp-name").value.trim() || "Concept", words });
    });
    if (groups.length < 2) return; // a connection needs >= 2 concepts with words
    out.push({
      name: card.querySelector(".theme-name").value.trim() || "Untitled theme",
      enabled: card.querySelector(".theme-encheck").checked,
      minGroups: parseInt(card.querySelector(".theme-majslider").value, 10) || majorityOf(groups.length),
      groups
    });
  });
  return out;
}

// Validate/clean an imported themes array before it touches storage or the UI.
function sanitizeThemes(arr) {
  return (Array.isArray(arr) ? arr : []).map(t => {
    if (!t || typeof t !== "object") return null;
    const groups = (Array.isArray(t.groups) ? t.groups : []).map(g => {
      const words = parseWords(Array.isArray(g && g.words) ? g.words.join(",") : (g && g.words));
      if (!words.length) return null;
      return { name: String((g && g.name) || "Concept").trim() || "Concept", words };
    }).filter(Boolean);
    if (groups.length < 2) return null;
    let need = Number.isFinite(t.minGroups) ? t.minGroups : majorityOf(groups.length);
    need = Math.max(2, Math.min(groups.length, need));
    return {
      name: String(t.name || "Untitled theme").trim() || "Untitled theme",
      enabled: t.enabled !== false,
      minGroups: need,
      groups
    };
  }).filter(Boolean);
}

function themesFlash(msg, ok) {
  themesStatusEl.textContent = msg;
  themesStatusEl.style.color = ok === false ? "var(--danger)" : "var(--ok)";
  setTimeout(() => (themesStatusEl.textContent = ""), 3500);
}

chrome.storage.sync.get({ themesEnabled: true, themes: [] }, s => {
  themesEnabledEl.checked = s.themesEnabled !== false;
  renderThemes(s.themes);
});

themesEnabledEl.addEventListener("change", () =>
  chrome.storage.sync.set({ themesEnabled: themesEnabledEl.checked }));

document.getElementById("addTheme").addEventListener("click", () => {
  themesEl.appendChild(makeThemeCard({
    name: "New theme",
    enabled: true,
    groups: [{ name: "", words: [] }, { name: "", words: [] }]
  }));
});

document.getElementById("saveThemes").addEventListener("click", () => {
  const themes = collectThemes();
  chrome.storage.sync.set({ themes, themesEnabled: themesEnabledEl.checked }, () => {
    const groupsTotal = themes.reduce((a, t) => a + t.groups.length, 0);
    themesFlash("Saved " + themes.length + " theme(s), " + groupsTotal + " concepts. Reddit tabs update automatically.");
  });
});

// ---- Community finder ----
const queryEl = document.getElementById("query");
const resultsEl = document.getElementById("results");

function fmtSubs(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(0) + "k";
  return String(n || 0);
}

function getHidden() {
  return new Promise(r => chrome.storage.sync.get({ hiddenSubs: [] },
    v => r(new Set((v.hiddenSubs || []).map(x => String(x).toLowerCase())))));
}

const blockedSection = document.getElementById("blocked-section");

function dismissSub(name, rowEl) {
  chrome.storage.sync.get({ hiddenSubs: [] }, v => {
    const set = new Set(v.hiddenSubs || []);
    set.add(name);
    chrome.storage.sync.set({ hiddenSubs: [...set] }, () => {
      if (rowEl) rowEl.remove();
      renderBlocked();
    });
  });
}

function unblockSub(name) {
  chrome.storage.sync.get({ hiddenSubs: [] }, v => {
    const list = (v.hiddenSubs || []).filter(s => s.toLowerCase() !== name.toLowerCase());
    chrome.storage.sync.set({ hiddenSubs: list }, renderBlocked);
  });
}

// Persistent list of blocked communities (names) with per-item un-block.
function renderBlocked() {
  chrome.storage.sync.get({ hiddenSubs: [] }, v => {
    const subs = v.hiddenSubs || [];
    blockedSection.innerHTML = "";
    if (!subs.length) return;

    const title = document.createElement("div");
    title.className = "section-title";
    title.textContent = "Blocked communities (" + subs.length + ")";
    blockedSection.appendChild(title);

    const wrap = document.createElement("div");
    wrap.className = "chips";
    subs.forEach(name => {
      const chip = document.createElement("span");
      chip.className = "chip";
      const label = document.createElement("span");
      label.textContent = "r/" + name;
      const rm = document.createElement("button");
      rm.className = "chip-x";
      rm.textContent = "×";
      rm.title = "Un-block r/" + name;
      rm.addEventListener("click", () => unblockSub(name));
      chip.appendChild(label);
      chip.appendChild(rm);
      wrap.appendChild(chip);
    });
    blockedSection.appendChild(wrap);

    const all = document.createElement("button");
    all.className = "link";
    all.textContent = "Un-block all";
    all.addEventListener("click", () => chrome.storage.sync.set({ hiddenSubs: [] }, renderBlocked));
    blockedSection.appendChild(all);
    blockedSection.appendChild(document.createElement("hr"));
  });
}

// Refresh the list if a community is blocked from the page while the popup is open.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.hiddenSubs) renderBlocked();
});
renderBlocked();

// ---- Export / Import (keywords, blocked communities, and all settings) ----
const backupStatus = document.getElementById("backupStatus");
function backupFlash(msg, ok) {
  backupStatus.textContent = msg;
  backupStatus.style.color = ok === false ? "var(--danger)" : "var(--ok)";
  setTimeout(() => (backupStatus.textContent = ""), 4000);
}

document.getElementById("exportBtn").addEventListener("click", () => {
  chrome.storage.sync.get(DEFAULTS, s => {
    const data = {
      _app: "reddit-positivity-filter",
      _version: 1,
      exportedAt: new Date().toISOString(),
      keywords: s.keywords || [],
      hiddenSubs: s.hiddenSubs || [],
      allowMode: s.allowMode,
      allowedSubs: s.allowedSubs || [],
      homeBlock: s.homeBlock,
      themes: s.themes || [],
      themesEnabled: s.themesEnabled,
      strict: s.strict,
      hideNsfw: s.hideNsfw,
      imgFilter: s.imgFilter,
      imgIncludeSexy: s.imgIncludeSexy,
      imgSensitivity: s.imgSensitivity,
      ocrEnabled: s.ocrEnabled
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "reddit-positivity-filter-backup.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    backupFlash("Exported " + (s.keywords || []).length + " keywords, " + (s.hiddenSubs || []).length + " blocked communities.");
  });
});

const importFile = document.getElementById("importFile");
document.getElementById("importBtn").addEventListener("click", () => importFile.click());
importFile.addEventListener("change", () => {
  const file = importFile.files && importFile.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    let data;
    try { data = JSON.parse(reader.result); }
    catch (e) { backupFlash("Invalid file — not valid JSON.", false); importFile.value = ""; return; }
    if (!data || typeof data !== "object") { backupFlash("Invalid backup file.", false); importFile.value = ""; return; }

    const patch = {};
    if (Array.isArray(data.keywords)) patch.keywords = data.keywords.map(String).map(w => w.trim()).filter(Boolean);
    if (Array.isArray(data.hiddenSubs)) patch.hiddenSubs = [...new Set(data.hiddenSubs.map(String).map(s => s.trim()).filter(Boolean))];
    if (Array.isArray(data.themes)) patch.themes = sanitizeThemes(data.themes);
    if (typeof data.allowMode === "boolean") patch.allowMode = data.allowMode;
    if (typeof data.homeBlock === "boolean") patch.homeBlock = data.homeBlock;
    if (Array.isArray(data.allowedSubs)) patch.allowedSubs = parseAllowedSubs(data.allowedSubs.join("\n"));
    if (typeof data.themesEnabled === "boolean") patch.themesEnabled = data.themesEnabled;
    if (typeof data.strict === "boolean") patch.strict = data.strict;
    if (typeof data.hideNsfw === "boolean") patch.hideNsfw = data.hideNsfw;
    if (typeof data.imgFilter === "boolean") patch.imgFilter = data.imgFilter;
    if (typeof data.imgIncludeSexy === "boolean") patch.imgIncludeSexy = data.imgIncludeSexy;
    if (Number.isFinite(data.imgSensitivity)) patch.imgSensitivity = Math.min(100, Math.max(1, data.imgSensitivity));
    if (typeof data.ocrEnabled === "boolean") patch.ocrEnabled = data.ocrEnabled;

    if (!("keywords" in patch) && !("hiddenSubs" in patch) && !("themes" in patch)) {
      backupFlash("No keywords, blocked communities or themes found in file.", false);
      importFile.value = ""; return;
    }
    // A lock can't be lifted by importing a file with hideNsfw:false.
    chrome.storage.sync.get({ nsfwLocked: false }, cur => {
      if (cur.nsfwLocked) patch.hideNsfw = true;
      chrome.storage.sync.set(patch, () => {
        if ("keywords" in patch) keywordsEl.value = patch.keywords.join("\n");
        if (typeof patch.strict === "boolean") strictEl.checked = patch.strict;
        if (typeof patch.hideNsfw === "boolean") nsfwEl.checked = patch.hideNsfw;
        if (typeof patch.imgFilter === "boolean") imgFilterEl.checked = patch.imgFilter;
        if (typeof patch.imgIncludeSexy === "boolean") imgSexyEl.checked = patch.imgIncludeSexy;
        if ("imgSensitivity" in patch) { sensEl.value = patch.imgSensitivity; sensValEl.textContent = patch.imgSensitivity; }
        if (typeof patch.ocrEnabled === "boolean") ocrEl.checked = patch.ocrEnabled;
        if (typeof patch.allowMode === "boolean") allowModeEl.checked = patch.allowMode;
        if (typeof patch.homeBlock === "boolean") homeBlockEl.checked = patch.homeBlock;
        if ("allowedSubs" in patch) allowedSubsEl.value = patch.allowedSubs.join("\n");
        if ("themes" in patch) renderThemes(patch.themes);
        if (typeof patch.themesEnabled === "boolean") themesEnabledEl.checked = patch.themesEnabled;
        renderBlocked();
        backupFlash("Imported " + (patch.keywords ? patch.keywords.length : 0) + " keywords, " +
          (patch.hiddenSubs ? patch.hiddenSubs.length : 0) + " blocked communities, " +
          (patch.themes ? patch.themes.length : 0) + " themes.");
      });
    });
    importFile.value = "";
  };
  reader.readAsText(file);
});

async function render(list) {
  const hidden = await getHidden();
  const shown = (list || []).filter(s => !hidden.has(s.name.toLowerCase()));
  if (!shown.length) {
    resultsEl.innerHTML = '<p class="muted">No communities found. Try a different term.</p>';
    return;
  }
  resultsEl.innerHTML = "";
  shown.forEach(s => {
    const row = document.createElement("div");
    row.className = "sub-row";

    const a = document.createElement("a");
    a.className = "sub";
    a.href = s.url;
    a.target = "_blank";
    a.rel = "noopener";
    const top = document.createElement("span");
    top.className = "subtop";
    const name = document.createElement("span");
    name.className = "name";
    name.textContent = "r/" + s.name;
    const subs = document.createElement("span");
    subs.className = "subs";
    subs.textContent = fmtSubs(s.subs) + " members";
    top.appendChild(name);
    top.appendChild(subs);
    a.appendChild(top);
    if (s.desc) {
      const d = document.createElement("span");
      d.className = "desc";
      d.textContent = s.desc;
      a.appendChild(d);
    }

    const blockBtn = document.createElement("button");
    blockBtn.className = "block-btn";
    blockBtn.title = "Block r/" + s.name + " — hide its posts everywhere and block the community page";
    blockBtn.textContent = "Block";
    blockBtn.addEventListener("click", () => dismissSub(s.name, row));

    row.appendChild(a);
    row.appendChild(blockBtn);
    resultsEl.appendChild(row);
  });
  renderBlocked();
}

async function directFetch(query) {
  // Fallback when no reddit.com tab is open (no session cookies; best effort).
  const url = "https://www.reddit.com/subreddits/search.json?q=" +
    encodeURIComponent(query) + "&limit=25&include_over_18=off&raw_json=1";
  const r = await fetch(url, { headers: { Accept: "application/json" } });
  if (!r.ok) throw new Error("HTTP " + r.status);
  const j = await r.json();
  const list = ((j.data && j.data.children) || [])
    .map(c => c.data)
    .filter(d => d && !d.over18 && !/^u_/i.test(d.display_name))
    .map(d => ({
      name: d.display_name,
      subs: d.subscribers || 0,
      url: "https://www.reddit.com/r/" + d.display_name + "/",
      desc: (d.public_description || "").slice(0, 140)
    }))
    .sort((a, b) => b.subs - a.subs)
    .slice(0, 20);
  return { ok: true, list };
}

// Shared by the finder tab and the allowlist search: prefer the content-script
// recommender (session-aware, related topics), fall back to a direct fetch.
async function searchReddit(q) {
  const tabs = await chrome.tabs.query({ url: "*://*.reddit.com/*" });
  if (tabs.length) {
    try {
      return await chrome.tabs.sendMessage(tabs[0].id, { type: "recommend", query: q });
    } catch (e) { /* content script not ready → fall back */ }
  }
  return directFetch(q);
}

async function find() {
  const q = queryEl.value.trim();
  if (!q) return;
  resultsEl.innerHTML = '<p class="muted">Searching…</p>';
  try {
    render((await searchReddit(q) || {}).list);
  } catch (e) {
    resultsEl.innerHTML = '<p class="muted">Couldn\'t reach Reddit. Open a reddit.com tab and try again.</p>';
  }
}

document.getElementById("find").addEventListener("click", find);
queryEl.addEventListener("keydown", (e) => { if (e.key === "Enter") find(); });

