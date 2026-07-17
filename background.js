/* Reddit Positivity Filter — background service worker
 *
 * Hosts an *offscreen document* that runs the on-device OCR engine (Tesseract.js).
 * Why offscreen and not here:
 *   - A service worker can't spawn the Web Worker Tesseract.js needs.
 *   - Reddit's page CSP blocks WebAssembly in the content script, but an offscreen
 *     document is an extension page, so it runs under the extension's own CSP
 *     (which allows 'wasm-unsafe-eval' — see manifest content_security_policy).
 *
 * The content script sends an image (as a data URL) here; we forward it to the
 * offscreen document, which returns the recognized text.
 */

const OFFSCREEN_PATH = "offscreen.html";
let creating = null; // de-dupe concurrent createDocument calls

async function ensureOffscreen() {
  const url = chrome.runtime.getURL(OFFSCREEN_PATH);
  const existing = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
    documentUrls: [url]
  });
  if (existing.length) return;
  if (creating) { await creating; return; }
  creating = chrome.offscreen.createDocument({
    url: OFFSCREEN_PATH,
    reasons: ["WORKERS"],
    justification: "Run on-device OCR (Tesseract.js / WebAssembly) to read text inside images."
  });
  try { await creating; } finally { creating = null; }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === "ocr-request") {
    (async () => {
      try {
        await ensureOffscreen();
        const res = await chrome.runtime.sendMessage({
          target: "offscreen", type: "ocr", dataUrl: msg.dataUrl
        });
        sendResponse(res || { ok: false, error: "no-response" });
      } catch (e) {
        sendResponse({ ok: false, error: String(e && e.message || e) });
      }
    })();
    return true; // keep the channel open for the async response
  }
});
