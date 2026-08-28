#!/usr/bin/env node
import { createHash } from "node:crypto";
import { chmodSync, existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { resolve } from "node:path";
import {
  applyBlindReviewDecision,
  finalizeBlindReviewPacket,
  reviewAt,
  reviewProgress,
  validateBlindReviewAssets,
} from "../services/rl-engine/blind-review-session.mjs";

function argument(name, fallback = null) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

const packetPath = argument("--packet");
const momentsPath = argument("--moments");
const handbookPath = argument("--handbook");
const outputPath = argument("--output");
const port = Number(argument("--port", "5177"));
if (!packetPath || !momentsPath || !handbookPath || !outputPath || !Number.isInteger(port) || port < 1024 || port > 65535) {
  console.error("Usage: node scripts/start-rl-blind-review.mjs --packet reviewer.json --moments moments.json --handbook handbook.md --output completed.json [--port 5177]");
  process.exit(1);
}

const sourcePacket = JSON.parse(readFileSync(resolve(packetPath), "utf8"));
const moments = JSON.parse(readFileSync(resolve(momentsPath), "utf8"));
const handbook = readFileSync(resolve(handbookPath), "utf8");
const destination = resolve(outputPath);
validateBlindReviewAssets(sourcePacket, moments);

function immutableFingerprint(packet) {
  const immutable = {
    schemaVersion: packet.schemaVersion,
    sourceReportFingerprint: packet.sourceReportFingerprint,
    labelSetVersion: packet.labelSetVersion,
    labelManualFingerprint: packet.labelManualFingerprint,
    reviewerSlot: packet.reviewerSlot,
    blindReview: packet.blindReview,
    candidateCount: packet.candidateCount,
    redactionPolicy: packet.redactionPolicy,
    rounds: packet.rounds.map((round) => ({
      round: round.round,
      reviews: round.reviews.map((review) => Object.fromEntries(
        Object.entries(review).filter(([key]) => key !== "label"),
      )),
    })),
  };
  return createHash("sha256").update(JSON.stringify(immutable)).digest("hex");
}

let packet = existsSync(destination) ? JSON.parse(readFileSync(destination, "utf8")) : sourcePacket;
validateBlindReviewAssets(packet, moments);
if (immutableFingerprint(packet) !== immutableFingerprint(sourcePacket)) {
  throw new Error("Existing output does not match the immutable source reviewer packet.");
}

function persist() {
  const temporary = `${destination}.tmp-${process.pid}`;
  writeFileSync(temporary, `${JSON.stringify(packet, null, 2)}\n`, { mode: 0o600 });
  chmodSync(temporary, 0o600);
  renameSync(temporary, destination);
  chmodSync(destination, 0o600);
}

function json(response, status, value) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(JSON.stringify(value));
}

function body(request) {
  return new Promise((resolveBody, reject) => {
    let text = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      text += chunk;
      if (text.length > 64 * 1024) reject(new Error("Request body is too large."));
    });
    request.on("end", () => {
      try { resolveBody(JSON.parse(text || "{}")); } catch { reject(new Error("Invalid JSON body.")); }
    });
    request.on("error", reject);
  });
}

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Replay Method blind review</title><style>
html{color-scheme:dark}body{margin:0;background:#101417;color:#edf3f6;font:15px system-ui,sans-serif}main{max-width:1180px;margin:auto;padding:20px}.bar,.grid,.labels{display:grid;gap:12px}.bar{grid-template-columns:1fr auto auto;align-items:center}.grid{grid-template-columns:minmax(0,2fr) minmax(300px,1fr);margin-top:16px}.card{background:#192126;border:1px solid #34434b;border-radius:10px;padding:14px}canvas{width:100%;aspect-ratio:82/102;background:#174b2e;border-radius:8px}.labels{grid-template-columns:1fr 1fr}label{display:grid;gap:5px}select,input,textarea,button{font:inherit;padding:9px;background:#10171b;color:#fff;border:1px solid #4b5c65;border-radius:6px}textarea{min-height:90px;resize:vertical}button{cursor:pointer;background:#285b75}.secondary{background:#263137}.danger{background:#713333}.row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.muted{color:#aebbc2}.error{color:#ffadad}.ok{color:#9ee6b2}pre{white-space:pre-wrap;max-height:320px;overflow:auto}.question{font-size:19px;line-height:1.35}.meta{font-variant-numeric:tabular-nums}@media(max-width:800px){.grid{grid-template-columns:1fr}.bar{grid-template-columns:1fr}.labels{grid-template-columns:1fr}}
</style></head><body><main>
<div class="bar"><div><h1>Blind replay review</h1><div id="progress" class="muted"></div></div><div class="row"><button id="prev" class="secondary">Previous</button><input id="index" type="number" min="1" style="width:90px"><button id="next" class="secondary">Next</button></div></div>
<div class="grid"><section class="card"><canvas id="field" width="820" height="1020"></canvas><div class="row"><button id="play">Play</button><input id="frame" type="range" min="0" value="0" style="flex:1"><span id="time" class="meta"></span></div><p class="muted">Top-down anonymized reconstruction. Verify the timestamp and context; do not infer model status.</p></section>
<section class="card"><div id="meta" class="muted meta"></div><p id="question" class="question"></p><div class="labels">
<label>Gameplay truth<select id="truth"><option value="">Choose</option><option>present</option><option>absent</option><option>uncertain</option></select></label>
<label>Timestamp correct<select id="timestamp"><option value="">Choose</option><option value="true">yes</option><option value="false">no</option></select></label>
<label>Context correct<select id="context"><option value="">Choose</option><option value="true">yes</option><option value="false">no</option></select></label>
<label>Coaching relevant<select id="relevance"><option value="">Choose</option><option value="true">yes</option><option value="false">no</option></select></label>
<label>Ambiguous<select id="ambiguous"><option value="">Choose</option><option value="true">yes</option><option value="false">no</option></select></label></div>
<label style="margin-top:12px">Notes<textarea id="notes" placeholder="Required for uncertain or ambiguous decisions"></textarea></label><div class="row" style="margin-top:12px"><button id="save">Save and next</button><span id="status"></span></div></section></div>
<section class="card" style="margin-top:16px"><details><summary>Label handbook</summary><pre id="handbook"></pre></details></section>
<section class="card" style="margin-top:16px"><h2>Finalize submission</h2><div class="labels"><label>Reviewer ID<input id="reviewerId"></label><label>Qualification<input id="qualification" placeholder="Rank and review experience"></label></div><button id="finalize" class="danger" style="margin-top:12px">Finalize only when all decisions are complete</button></section>
</main><script>
let session,current,index=0,playing=false,timer=null;const $=id=>document.getElementById(id);const bool=v=>v===''?null:v==='true';
async function api(path,options){const r=await fetch(path,options);const value=await r.json();if(!r.ok)throw new Error(value.error||'Request failed');return value}
function draw(){if(!current)return;const c=$('field'),x=c.getContext('2d'),frames=current.moment.frames||[],f=frames[+$('frame').value]||frames[0];x.clearRect(0,0,c.width,c.height);x.fillStyle='#174b2e';x.fillRect(0,0,c.width,c.height);x.strokeStyle='#d9eee0';x.lineWidth=3;x.strokeRect(1,1,c.width-2,c.height-2);x.beginPath();x.moveTo(0,c.height/2);x.lineTo(c.width,c.height/2);x.stroke();x.beginPath();x.arc(c.width/2,c.height/2,90,0,Math.PI*2);x.stroke();if(!f)return;const px=v=>(v+4096)/8192*c.width,py=v=>c.height-(v+5120)/10240*c.height;(f.p||[]).forEach((p,i)=>{const r=current.moment.roster[i]||{};x.fillStyle=r.subject?'#ffe66d':r.team===0?'#69b7ff':'#ff7272';x.beginPath();x.arc(px(p[0]),py(p[1]),r.subject?12:9,0,Math.PI*2);x.fill()});x.fillStyle='#fff';x.beginPath();x.arc(px(f.b[0]),py(f.b[1]),8,0,Math.PI*2);x.fill();$('time').textContent=(f.t>=0?'+':'')+f.t.toFixed(2)+' s'}
function loadLabel(l){$('truth').value=l.gameplayTruth||'';$('timestamp').value=l.timestampVerified===null?'':String(l.timestampVerified);$('context').value=l.contextCorrect===null?'':String(l.contextCorrect);$('relevance').value=l.coachingRelevance===null?'':String(l.coachingRelevance);$('ambiguous').value=l.ambiguous===null?'':String(l.ambiguous);$('notes').value=l.notes||''}
async function load(i){index=Math.max(0,Math.min(session.total-1,i));current=await api('/api/review?index='+index);$('index').value=index+1;$('index').max=session.total;$('question').textContent=current.review.reviewQuestion;$('meta').textContent=(index+1)+' / '+session.total+' · '+current.review.detectorId+'@'+current.review.detectorVersion+' · '+current.review.mode+' · '+current.review.rankCohort;$('frame').max=Math.max(0,current.moment.frames.length-1);$('frame').value=0;loadLabel(current.review.label);draw()}
async function refresh(){session=await api('/api/session');$('progress').textContent=session.progress.complete+' complete · '+session.progress.remaining+' remaining · '+session.reviewerSlot;$('reviewerId').value=session.reviewer.reviewerId||'';$('qualification').value=session.reviewer.qualification||'';$('handbook').textContent=session.handbook}
async function save(){try{$('status').className='';$('status').textContent='Saving…';const label={gameplayTruth:$('truth').value,timestampVerified:bool($('timestamp').value),contextCorrect:bool($('context').value),coachingRelevance:bool($('relevance').value),ambiguous:bool($('ambiguous').value),notes:$('notes').value};await api('/api/review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({candidateId:current.review.candidateId,label})});$('status').className='ok';$('status').textContent='Saved';await refresh();await load(index+1)}catch(e){$('status').className='error';$('status').textContent=e.message}}
$('prev').onclick=()=>load(index-1);$('next').onclick=()=>load(index+1);$('index').onchange=()=>load(+$('index').value-1);$('frame').oninput=draw;$('save').onclick=save;$('play').onclick=()=>{playing=!playing;$('play').textContent=playing?'Pause':'Play';clearInterval(timer);if(playing)timer=setInterval(()=>{let n=+$('frame').value+1;if(n>+$('frame').max)n=0;$('frame').value=n;draw()},200)};$('finalize').onclick=async()=>{try{const value=await api('/api/finalize',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({reviewerId:$('reviewerId').value,qualification:$('qualification').value})});alert('Finalized at '+value.submittedAt);await refresh()}catch(e){alert(e.message)}};
(async()=>{await refresh();await load(0)})().catch(e=>document.body.textContent=e.message);
</script></body></html>`;

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, "http://127.0.0.1");
    if (request.method === "GET" && url.pathname === "/") {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" });
      response.end(html);
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/session") {
      json(response, 200, {
        reviewerSlot: packet.reviewerSlot,
        reviewer: packet.reviewer,
        total: packet.candidateCount,
        progress: reviewProgress(packet),
        handbook,
      });
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/review") {
      json(response, 200, reviewAt(packet, moments, Number(url.searchParams.get("index"))));
      return;
    }
    if (request.method === "POST" && url.pathname === "/api/review") {
      const value = await body(request);
      packet = applyBlindReviewDecision(packet, String(value.candidateId ?? ""), value.label);
      persist();
      json(response, 200, { saved: true, progress: reviewProgress(packet) });
      return;
    }
    if (request.method === "POST" && url.pathname === "/api/finalize") {
      const value = await body(request);
      packet = finalizeBlindReviewPacket(packet, value);
      persist();
      json(response, 200, { finalized: true, submittedAt: packet.reviewer.submittedAt });
      return;
    }
    json(response, 404, { error: "Not found." });
  } catch (error) {
    json(response, 400, { error: error instanceof Error ? error.message : "Review session failed." });
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Blind review session for ${packet.reviewerSlot}: http://127.0.0.1:${port}`);
  console.log(`Progress is written atomically to ${destination}`);
});
