const DEFAULTS = {
  enabled: true,
  strict: false,
  hideNsfw: true,
  nsfwLocked: false,
  imgFilter: true,
  imgIncludeSexy: false,
  imgSensitivity: 60,
  hiddenSubs: [],
  keywords: [] // real defaults live in content.js; popup fills from storage
};

// ---- Tab switching ----
document.querySelectorAll(".tab").forEach(t => {
  t.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(x => x.classList.remove("active"));
    document.querySelectorAll(".panel").forEach(x => x.classList.remove("active"));
    t.classList.add("active");
    document.getElementById("panel-" + t.dataset.tab).classList.add("active");
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
    imgSensitivity: parseInt(sensEl.value, 10) || 60
  };
  if (keywords.length) patch.keywords = keywords; // keep defaults if textarea empty
  chrome.storage.sync.set(patch, () => { if (msg) flash(msg); });
}

// Toggles/slider apply immediately; keyword edits save on button click.
[enabledEl, strictEl, nsfwEl, imgFilterEl, imgSexyEl].forEach(el =>
  el.addEventListener("change", () => saveAll("Applied.")));
sensEl.addEventListener("input", () => { sensValEl.textContent = sensEl.value; });
sensEl.addEventListener("change", () => saveAll("Applied."));
document.getElementById("save").addEventListener("click", () =>
  saveAll("Saved. Reddit tabs update automatically."));

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
  backupStatus.style.color = ok === false ? "#c0392b" : "#2e7d32";
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
      strict: s.strict,
      hideNsfw: s.hideNsfw,
      imgFilter: s.imgFilter,
      imgIncludeSexy: s.imgIncludeSexy,
      imgSensitivity: s.imgSensitivity
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
    if (typeof data.strict === "boolean") patch.strict = data.strict;
    if (typeof data.hideNsfw === "boolean") patch.hideNsfw = data.hideNsfw;
    if (typeof data.imgFilter === "boolean") patch.imgFilter = data.imgFilter;
    if (typeof data.imgIncludeSexy === "boolean") patch.imgIncludeSexy = data.imgIncludeSexy;
    if (Number.isFinite(data.imgSensitivity)) patch.imgSensitivity = Math.min(100, Math.max(1, data.imgSensitivity));

    if (!("keywords" in patch) && !("hiddenSubs" in patch)) {
      backupFlash("No keywords or blocked communities found in file.", false);
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
        renderBlocked();
        backupFlash("Imported " + (patch.keywords ? patch.keywords.length : 0) + " keywords, " + (patch.hiddenSubs ? patch.hiddenSubs.length : 0) + " blocked communities.");
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

async function find() {
  const q = queryEl.value.trim();
  if (!q) return;
  resultsEl.innerHTML = '<p class="muted">Searching…</p>';
  try {
    const tabs = await chrome.tabs.query({ url: "*://*.reddit.com/*" });
    let res;
    if (tabs.length) {
      try {
        res = await chrome.tabs.sendMessage(tabs[0].id, { type: "recommend", query: q });
      } catch (e) {
        res = await directFetch(q); // content script not ready → fallback
      }
    } else {
      res = await directFetch(q);
    }
    render(res && res.list);
  } catch (e) {
    resultsEl.innerHTML = '<p class="muted">Couldn\'t reach Reddit. Open a reddit.com tab and try again.</p>';
  }
}

document.getElementById("find").addEventListener("click", find);
queryEl.addEventListener("keydown", (e) => { if (e.key === "Enter") find(); });
