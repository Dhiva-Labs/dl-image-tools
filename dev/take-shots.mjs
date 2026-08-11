#!/usr/bin/env node
// Store-screenshot driver: launches headless Chrome with CDP, waits for the
// dev harness to signal readiness (document.title === 'shot-ready') plus a
// settle delay for async worker results, then captures 1280×800 PNGs.
// Usage: node dev/take-shots.mjs   (server must be running on :8741)
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';

const BASE = 'http://localhost:8741/dev/dev.html';
const OUT = 'store-assets';
const SHOTS = [
  { name: '01-import-light', qs: 'shot=import&theme=light' },
  { name: '02-compress-light', qs: 'shot=compress&files=medium-1m.jpg&theme=light' },
  { name: '03-resize-light', qs: 'shot=resize&files=medium-1m.jpg&theme=light' },
  { name: '04-crop-light', qs: 'shot=crop&files=sample.webp&theme=light' },
  { name: '05-batch-dark', qs: 'shot=batch&files=medium-1m.jpg,sample.webp,tiny.png,transparent.png&theme=dark' },
];

const port = 9333;
const chrome = spawn('google-chrome', [
  '--headless=new', '--disable-gpu', '--hide-scrollbars',
  `--remote-debugging-port=${port}`, '--window-size=1280,800',
  '--user-data-dir=/tmp/claude-1000/shot-profile', 'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getWsUrl() {
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch(`http://localhost:${port}/json/version`);
      return (await res.json()).webSocketDebuggerUrl;
    } catch { await sleep(200); }
  }
  throw new Error('Chrome CDP endpoint never came up');
}

let msgId = 0;
const pending = new Map();
function send(ws, method, params = {}, sessionId) {
  const id = ++msgId;
  ws.send(JSON.stringify({ id, method, params, sessionId }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

const ws = new WebSocket(await getWsUrl());
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
  }
};
await new Promise((r) => { ws.onopen = r; });

const { targetId } = await send(ws, 'Target.createTarget', { url: 'about:blank' });
const { sessionId } = await send(ws, 'Target.attachToTarget', { targetId, flatten: true });
await send(ws, 'Page.enable', {}, sessionId);
await send(ws, 'Runtime.enable', {}, sessionId);
await send(ws, 'Emulation.setDeviceMetricsOverride',
  { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false }, sessionId);

async function evalJs(expr) {
  const r = await send(ws, 'Runtime.evaluate', { expression: expr, returnByValue: true }, sessionId);
  return r.result.value;
}

mkdirSync(OUT, { recursive: true });
for (const { name, qs } of SHOTS) {
  await send(ws, 'Page.navigate', { url: `${BASE}?${qs}` }, sessionId);
  let ready = false;
  for (let i = 0; i < 100 && !ready; i++) {
    await sleep(300);
    ready = await evalJs('document.title === "shot-ready"');
  }
  if (!ready) { console.error(`${name}: never became ready, capturing anyway`); }
  // let worker results, previews, and thumbnails finish rendering
  await sleep(3000);
  const busy = await evalJs('!!document.querySelector(".is-busy")');
  if (busy) await sleep(3000);
  const { data } = await send(ws, 'Page.captureScreenshot', { format: 'png' }, sessionId);
  writeFileSync(`${OUT}/${name}.png`, Buffer.from(data, 'base64'));
  console.log(`${name}.png captured`);
}

ws.close();
chrome.kill();
