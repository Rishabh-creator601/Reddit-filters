/* Offscreen document: runs Tesseract.js OCR entirely on-device.
 * All engine files (worker, wasm core, English data) are bundled in the
 * extension and loaded via chrome-extension:// URLs — no network access. */

let workerPromise = null;

async function getWorker() {
  if (workerPromise) return workerPromise;
  workerPromise = (async () => {
    // Tesseract is the global exposed by tesseract.min.js.
    const worker = await Tesseract.createWorker("eng", 1, {
      workerPath: chrome.runtime.getURL("vendor/tesseract/worker.min.js"),
      corePath:   chrome.runtime.getURL("vendor/tesseract/"),          // dir: picks simd/non-simd core
      langPath:   chrome.runtime.getURL("vendor/tesseract/tessdata"),  // holds eng.traineddata.gz
      cacheMethod: "none" // don't stash traineddata in IndexedDB; it's already bundled
    });
    return worker;
  })().catch(err => { workerPromise = null; throw err; });
  return workerPromise;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.target === "offscreen" && msg.type === "ocr") {
    (async () => {
      try {
        const worker = await getWorker();
        const { data } = await worker.recognize(msg.dataUrl);
        sendResponse({ ok: true, text: (data && data.text) || "" });
      } catch (e) {
        sendResponse({ ok: false, error: String(e && e.message || e) });
      }
    })();
    return true; // async response
  }
});
