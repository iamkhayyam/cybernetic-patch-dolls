#!/usr/bin/env node
// demo — births a cast, opens a floor, runs real signed work, then closes it.
//
//   node bin/demo.mjs [--fresh]
//
// --fresh wipes the existing registry first. Everything this produces is genuine:
// real keypairs, real signatures, real hash-chained care records.

import { spawn } from 'node:child_process';
import { rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, DOLLS_DIR, REGISTRY, loadRegistry } from '../lib/core.mjs';

const HUB = 'http://127.0.0.1:4020';
const kids = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function run(args, { quiet = true } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath, args, { cwd: ROOT, stdio: quiet ? 'pipe' : 'inherit' });
    let out = '';
    if (quiet) { p.stdout.on('data', (d) => { out += d; }); p.stderr.on('data', (d) => { out += d; }); }
    p.on('close', (code) => (code === 0 ? resolve(out) : reject(new Error(out || `exit ${code}`))));
  });
}

function serve(args) {
  const p = spawn(process.execPath, args, { cwd: ROOT, stdio: 'pipe' });
  p.stdout.on('data', () => {});
  p.stderr.on('data', () => {});
  kids.push(p);
  return p;
}

const shutdown = () => { for (const p of kids) { try { p.kill(); } catch {} } };
process.on('exit', shutdown);
process.on('SIGINT', () => { shutdown(); process.exit(130); });

async function waitFor(check, label, timeoutMs = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try { if (await check()) return; } catch {}
    await sleep(300);
  }
  throw new Error(`timed out waiting for ${label}`);
}

const CAST = [
  { name: 'Rowan Whipstitch', role: 'First of the Founders', caps: 'conversation,scheduling,ranch-sensor-telemetry',
    bounds: 'no financial transactions,no unsupervised outbound email', port: 4021, price: 3 },
  { name: 'Thistle Applique', role: 'Wordsmith of the bee', caps: 'haiku,summarize',
    bounds: 'no financial transactions', port: 4022, price: 3 },
  { name: 'Fennel Gusset', role: 'Field analyst', caps: 'wordcount,telemetry-report',
    bounds: 'no financial transactions,telemetry is advisory only', port: 4023, price: 2 },
];

// ---------- 1. the cast ----------

if (process.argv.includes('--fresh')) {
  rmSync(DOLLS_DIR, { recursive: true, force: true });
  rmSync(REGISTRY, { force: true });
  rmSync(join(ROOT, 'hub-state.json'), { force: true });
  console.log('Wiped the registry.');
}

if (!loadRegistry().dolls.length) {
  console.log('Birthing the cast...');
  for (const c of CAST) {
    // No --contact: a published demo names a steward without publishing an inbox.
    await run(['bin/patchdoll.mjs', 'birth', '--name', c.name, '--creator', 'iamkhayyam',
      '--model', 'claude-fable-5', '--role', c.role, '--capabilities', c.caps, '--boundaries', c.bounds]);
    console.log(`  ${c.name}`);
  }
}

const slugOf = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-');

// ---------- 2. lifecycle events ----------

await run(['bin/patchdoll.mjs', 'care', slugOf('Rowan Whipstitch'), '--type', 'patch',
  '--note', 'Safety evaluation v1 passed; guardrail patch 2026.08 applied.']);
await run(['bin/patchdoll.mjs', 'care', slugOf('Rowan Whipstitch'), '--type', 'checkup',
  '--note', 'First field checkup: telemetry link to herd sensors nominal.']);
await run(['bin/patchdoll.mjs', 'care', slugOf('Fennel Gusset'), '--type', 'checkup',
  '--note', 'Calibrated against the north pasture gate sensors.']);

// ---------- 3. open the floor ----------

console.log('Opening the Quilting Bee...');
serve(['bin/patchhub.mjs', '--port', '4020']);
await waitFor(async () => (await fetch(`${HUB}/api/state`)).ok, 'the hub');

for (const c of CAST) serve(['bin/dollhouse.mjs', slugOf(c.name), '--port', String(c.port), '--price', String(c.price)]);
await waitFor(async () => {
  const s = await fetch(`${HUB}/api/state`).then((r) => r.json());
  return s.dolls.filter((d) => d.online).length === CAST.length;
}, 'all three dolls to enroll');
console.log('  three dolls present');

// ---------- 4. real work ----------

console.log('Running commissions...');
await run(['bin/bee.mjs', 'hire', '--as', slugOf('Rowan Whipstitch'), '--cap', 'haiku',
  '--input', 'cold morning in the cabbage patch']);
await run(['bin/bee.mjs', 'quilt', '--as', slugOf('Rowan Whipstitch'), '--job', 'Morning herd briefing',
  '--steps', 'telemetry-report: north pasture herd || summarize: @prev || haiku: @prev']);
await run(['bin/bee.mjs', 'quilt', '--as', slugOf('Fennel Gusset'), '--job', 'Evening pasture note',
  '--steps', 'scheduling: vet visit for collar batteries || haiku: @prev']);
await run(['bin/bee.mjs', 'hire', '--as', slugOf('Fennel Gusset'), '--cap', 'summarize',
  '--input', 'The north pasture herd is calm. Water levels held overnight. No collar alerts.']);

const final = await fetch(`${HUB}/api/state`).then((r) => r.json());
console.log(`\nSettled ${final.threadsInFlight} threads across ${final.transactions.length} shown transactions.`);
for (const d of final.dolls) console.log(`  ${d.name.padEnd(20)} ${String(d.balance).padStart(4)} threads`);

shutdown();
await sleep(400);
console.log('\nFloor closed. Rebuild the site with: npm run build');
process.exit(0);
