// End-to-end audit of the IGCSE English course progress system.
// Drives a real headless Chrome over CDP using real user paths
// (DOM.setFileInputFiles for the file picker, real button clicks).
//
//   node tests/progress-audit.mjs [base-url]
//
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BASE = process.argv[2] || "https://roryquarrier.github.io/igcse-english-refresher/index.html";
const PORT = 9300 + Math.floor(Math.random() * 400);
const CHROME = process.env.CHROME_BIN || "/home/hal/chrome-stable/opt/google/chrome/chrome";
const TMP = mkdtempSync(join(tmpdir(), "igcse-audit-"));

const results = [];
const log = (name, pass, detail) => {
  results.push({ name, pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail === undefined ? "" : "  " + JSON.stringify(detail)}`);
};

const chrome = spawn(CHROME, [
  "--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage",
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${join(TMP, "profile")}`,
  "--no-first-run", "--no-default-browser-check", "--window-size=1366,940",
  `${BASE}#module-01`,
], { stdio: "ignore" });

async function findTarget() {
  for (let i = 0; i < 60; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const p = list.find((t) => t.type === "page" && t.url.includes("igcse-english"));
      if (p && p.webSocketDebuggerUrl) return p;
    } catch (e) { /* not up yet */ }
    await sleep(500);
  }
  throw new Error("no CDP page target");
}

const page = await findTarget();
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

let msgId = 0;
const pending = new Map();
let uncaught = 0;
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  if (m.method === "Runtime.exceptionThrown") uncaught++;
};

const send = (method, params = {}) => {
  const id = ++msgId;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((r) => pending.set(id, r));
};

async function ev(expression, timeoutMs = 8000) {
  const p = send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  const r = await Promise.race([p, new Promise((res) => setTimeout(() => res({ __timeout: true }), timeoutMs))]);
  if (r.__timeout) return "TIMEOUT";
  if (r.result && r.result.exceptionDetails) {
    return "EXC:" + (r.result.exceptionDetails.exception?.description || "");
  }
  return r.result?.result?.value;
}

const STORE = `JSON.parse(localStorage.getItem('igcse-english.progress.v2')||'null')`;
const dashNumbers = () => ev(`JSON.stringify(Array.from(document.querySelectorAll('.stat-val')).map(n=>n.textContent.trim()))`);

async function boot() {
  for (let i = 0; i < 60; i++) {
    if (await ev(`document.querySelectorAll('#navList .nav-item').length===13`)) return true;
    await sleep(300);
  }
  return false;
}

async function goTo(sid) {
  await ev(`location.hash='#${sid}'`);
  for (let i = 0; i < 40; i++) {
    const cur = await ev(`(function(){var a=document.querySelector('#navList .nav-item.active');return a?a.dataset.id:null;})()`);
    if (cur === sid) return true;
    await sleep(150);
  }
  return false;
}

async function fileInputNodeId() {
  const doc = await send("DOM.getDocument");
  const q = await send("DOM.querySelector", {
    nodeId: doc.result.root.nodeId,
    selector: ".dash-tools input[type=file]",
  });
  return q.result.nodeId;
}

await send("Page.enable");
await send("Runtime.enable");
await send("DOM.enable");
await boot();

/* ---------- 1. clean slate ---------- */
await ev(`localStorage.clear()`);
await ev(`location.reload()`);
await sleep(1500);
await boot();
const fresh = await ev(STORE);
log("fresh visit starts empty", fresh === null || (!fresh.name && !Object.keys(fresh.done || {}).length && !Object.keys(fresh.quiz || {}).length));

/* ---------- 2. build a real session by clicking ---------- */
const plan = [["module-01", 5], ["module-02", 8], ["module-04", 6], ["module-08", 2], ["module-05", 5]];
for (const [sid, correctCount] of plan) {
  await goTo(sid);
  await ev(`(function(){ var qs=window.COURSE.sections.find(s=>s.id==='${sid}').quiz.questions;
    document.querySelectorAll('#quizHost .quiz-q').forEach(function(li,i){
      li.querySelectorAll('.opt')[i<${correctCount}?qs[i].answer:(qs[i].answer+1)%qs[i].options.length].click(); }); })()`);
  await sleep(250);
  await ev(`(function(){var c=document.getElementById('doneToggle'); c.checked=true; c.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await sleep(150);
}
await goTo("dashboard");
await sleep(500);
await ev(`(function(){var i=document.getElementById('studentName'); i.value='Ah Ming'; i.dispatchEvent(new Event('input',{bubbles:true}));})()`);
await sleep(400);

const truth = await ev(`(function(){ var s=${STORE}, D=window.COURSE.sections, Q=D.filter(x=>x.quiz);
  var done=D.filter(x=>s.done[x.id]).length, totalQ=0, best=0, tried=0;
  Q.forEach(function(x){ var r=s.quiz[x.id]; totalQ+=x.quiz.questions.length;
    if(r){tried++; best+=Math.min(r.best||0,x.quiz.questions.length);} });
  return {name:s.name, done:done, sections:D.length, best:best, totalQ:totalQ, tried:tried, qSections:Q.length}; })()`);
const expectedNumbers = JSON.stringify([
  truth.done + " / " + truth.sections,
  truth.best + " / " + truth.totalQ,
  truth.tried + " / " + truth.qSections,
  Math.round((truth.best / truth.totalQ) * 100) + "%",
]);
const dashBefore = await dashNumbers();
log("a full session was created by real clicks",
  truth.done === plan.length && truth.tried === plan.length && truth.name === "Ah Ming", truth);
log("dashboard numbers equal a fresh computation from the store",
  dashBefore === expectedNumbers, { shown: dashBefore, computed: expectedNumbers });
log("header pill, header bar and dashboard bar all agree",
  (await ev(`document.getElementById('progressPill').textContent.trim()`)).startsWith(String(truth.done)) &&
  (await ev(`document.querySelector('#progressBar span').style.width`)) === (await ev(`document.querySelector('.dash-bar span').style.width`)));

/* ---------- 3. export through the real button ---------- */
const blobInfo = await ev(`(function(){ var orig=URL.createObjectURL.bind(URL); var cap=null;
  URL.createObjectURL=function(b){cap=b;return orig(b);};
  Array.from(document.querySelectorAll('.dash-tools .btn')).find(b=>/Export/.test(b.textContent)).click();
  URL.createObjectURL=orig; return cap ? cap.size + ":" + cap.type : "NO_BLOB"; })()`);
log("Export downloads a JSON file", /^[0-9]+:application\/json$/.test(blobInfo), blobInfo);

const snapshotJson = await ev(`localStorage.getItem('igcse-english.progress.v2')`);
const goodFile = join(TMP, "progress-good.json");
const badFile = join(TMP, "progress-bad.json");
const junkFile = join(TMP, "progress-junk.json");
const shapeFile = join(TMP, "progress-shape.json");
writeFileSync(goodFile, snapshotJson);
writeFileSync(badFile, '{"totally":"wrong"}');
writeFileSync(junkFile, "<<<not json at all>>>");
writeFileSync(shapeFile, '{"v":2,"name":123,"done":"yes","quiz":{"module-01":{"answers":"no","best":"high"}}}');

const nodeId = await fileInputNodeId();

/* ---------- 4. bad imports must not freeze the page or lose progress ---------- */
await send("DOM.setFileInputFiles", { files: [badFile], nodeId });
await sleep(1300);
const afterBad = await ev(`JSON.stringify({ renders: document.querySelectorAll('.stat-val').length,
  notice: (document.querySelector('.notice')||{}).textContent || null,
  quizKeys: Object.keys((${STORE}||{}).quiz || {}).length })`, 5000);
const ab = JSON.parse(afterBad);
log("unrelated JSON: page alive, warning shown, progress untouched",
  ab.renders === 4 && /not an IGCSE English progress export/.test(ab.notice || "") && ab.quizKeys === plan.length, ab);

await send("DOM.setFileInputFiles", { files: [junkFile], nodeId });
await sleep(1300);
const afterJunk = await ev(`JSON.stringify({ renders: document.querySelectorAll('.stat-val').length,
  notice: (document.querySelector('.notice')||{}).textContent || null })`, 5000);
log("unparseable file: page alive, warning shown",
  JSON.parse(afterJunk).renders === 4 && /not an IGCSE English progress export/.test(JSON.parse(afterJunk).notice || ""), afterJunk);

await send("DOM.setFileInputFiles", { files: [shapeFile], nodeId });
await sleep(1300);
const afterShape = await ev(`(function(){ var s=${STORE};
  return JSON.stringify({ nameType: typeof s.name, bestType: typeof (s.quiz['module-01']||{}).best,
    renders: document.querySelectorAll('.stat-val').length }); })()`, 5000);
const ash = JSON.parse(afterShape);
log("valid JSON with wrong types is normalised, not fatal",
  ash.nameType === "string" && ash.bestType === "number" && ash.renders === 4, ash);

/* ---------- 5. a genuine export imports cleanly ---------- */
await send("DOM.setFileInputFiles", { files: [goodFile], nodeId });
await sleep(1500);
const storeBack = await ev(STORE);
log("genuine export restores name, completions and every quiz record",
  storeBack.name === "Ah Ming" &&
  Object.keys(storeBack.done).length === truth.done &&
  Object.keys(storeBack.quiz).length === truth.tried,
  { name: storeBack.name, done: Object.keys(storeBack.done).length, quiz: Object.keys(storeBack.quiz).length });
log("dashboard numbers identical after export → reset-free import", (await dashNumbers()) === expectedNumbers);

/* ---------- 6. survives a full reload ---------- */
await ev(`location.reload()`);
await sleep(1600);
await boot();
await goTo("dashboard");
await sleep(500);
log("imported progress survives a full reload", (await dashNumbers()) === expectedNumbers);

/* ---------- 7. answers and ticks are restored on the page ---------- */
await goTo("module-01");
await sleep(400);
const restored = await ev(`(function(){ var s=${STORE}.quiz['module-01'];
  return JSON.stringify({ answered: document.querySelectorAll('#quizHost .quiz-q.answered').length,
    ticked: document.getElementById('doneToggle').checked, storedBest: s.best }); })()`);
const rs = JSON.parse(restored);
log("module-01 keeps its answered questions, best score and completion tick",
  rs.answered === 5 && rs.ticked === true && rs.storedBest === 5, rs);

/* ---------- 8. every dashboard row matches the store ---------- */
await goTo("dashboard");
await sleep(500);
const rows = await ev(`JSON.stringify(Array.from(document.querySelectorAll('.dash-table tbody tr')).map(function(tr){
  return Array.from(tr.querySelectorAll('td')).map(function(td){ return td.textContent.trim(); }); }))`);
const expectedRows = await ev(`(function(){ var s=${STORE}; var out=[];
  window.COURSE.sections.forEach(function(x){ if(x.id==='dashboard') return;
    var read = s.done[x.id] ? '✅ yes' : '⬜ no';
    if(x.quiz){ var r=s.quiz[x.id]; var ans=r&&r.answers?Object.keys(r.answers).length:0; var tot=x.quiz.questions.length;
      out.push([x.emoji+' '+x.label, read, ans+' / '+tot+' done', r?(r.best+' / '+tot):'—', r&&r.attempts?String(r.attempts):'—']); }
    else { out.push([x.emoji+' '+x.label, read, 'no quiz']); } });
  return JSON.stringify(out); })()`);
const R = JSON.parse(rows), E = JSON.parse(expectedRows);
const mismatches = R.map((r, i) => (JSON.stringify(r) === JSON.stringify(E[i]) ? null : { row: r, expected: E[i] })).filter(Boolean);
log("all dashboard rows match the store cell-for-cell", mismatches.length === 0 && R.length === E.length,
  mismatches.length ? mismatches.slice(0, 2) : { rows: R.length });

/* ---------- 9. reset asks first, then truly empties (run last) ---------- */
await ev(`Array.from(document.querySelectorAll('.dash-tools .btn')).find(b=>/Reset/.test(b.textContent)).click()`);
await sleep(500);
const asked = await ev(`JSON.stringify({ notices: document.querySelectorAll('.notice').length,
  stillIntact: !!(${STORE}||{}).name })`);
log("Reset asks for confirmation inline and erases nothing yet",
  JSON.parse(asked).notices >= 1 && JSON.parse(asked).stillIntact === true, asked);
await ev(`Array.from(document.querySelectorAll('.notice .btn')).find(b=>/Erase everything/.test(b.textContent)).click()`);
await sleep(600);
const wiped = await ev(STORE);
log("confirming erases done, quiz and name",
  Object.keys(wiped.quiz).length === 0 && Object.keys(wiped.done).length === 0 && wiped.name === "",
  { quiz: Object.keys(wiped.quiz).length, done: Object.keys(wiped.done).length, name: wiped.name });
log("dashboard shows zeros right after reset", (await dashNumbers()) === JSON.stringify(["0 / 13", "0 / 51", "0 / 8", "0%"]));
log("page is still responsive after reset (no blocked dialog)", (await ev(`1+1`)) === 2);

/* ---------- 10. a corrupt store fails safe ---------- */
await ev(`localStorage.setItem('igcse-english.progress.v2','{broken')`);
await ev(`location.reload()`);
await sleep(1600);
log("app boots with a corrupt store and stays usable", (await boot()) === true && (await ev(`1+1`)) === 2);

/* ---------- 11. no uncaught exceptions anywhere ---------- */
log("no uncaught page exceptions during the whole run", uncaught === 0, uncaught);

const passed = results.filter((r) => r.pass).length;
console.log("\n---SUMMARY---");
console.log(JSON.stringify({ total: results.length, passed, failed: results.filter((r) => !r.pass).map((r) => r.name) }));

ws.close();
chrome.kill("SIGKILL");
process.exit(passed === results.length ? 0 : 1);
