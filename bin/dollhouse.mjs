#!/usr/bin/env node
// dollhouse — run a Patch Doll as an HTTP agent that sells capabilities behind x402.
//
//   node bin/dollhouse.mjs <slug> --port 4021 [--hub http://127.0.0.1:4020] [--price 3]
//
// Protocol (x402-inspired, threads are a fictional ledger unit — no real money):
//   POST /x402/<capability> {input}            -> 402 + payment terms {price, payTo, nonce}
//   POST /x402/<capability> + X-Payment header -> verify voucher, settle at hub, do work,
//                                                 return {result, receipt} (receipt signed)

import http from 'node:http';
import { randomBytes } from 'node:crypto';
import {
  loadDoll,
  loadPrivateKey,
  signRecord,
  verifyWithRawKey,
  sha256hex,
  recordHash,
  appendCare,
  short,
} from '../lib/core.mjs';

// ---------- args ----------

const argv = process.argv.slice(2);
const slug = argv[0];
const flag = (name, dflt) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
};
if (!slug || slug.startsWith('--')) {
  console.error('Usage: dollhouse <slug> --port 4021 [--hub http://127.0.0.1:4020] [--price 3]');
  process.exit(1);
}
const PORT = Number(flag('port', 4021));
const HUB = flag('hub', 'http://127.0.0.1:4020');
const DEFAULT_PRICE = Number(flag('price', 3));

const { genesis } = loadDoll(slug);
const privateKeyPem = loadPrivateKey(slug);
const me = genesis.record;

// ---------- capability handlers ----------
// Deterministic toy skills for v0 — in production these call the doll's actual model/tools.

const seeded = (input) => Buffer.from(sha256hex(input), 'hex');

const HANDLERS = {
  'haiku': (input) => {
    const w = input.split(/\s+/).filter(Boolean);
    const pick = (i) => w[i % w.length] || 'thread';
    return `${pick(0)} in the ${pick(1)}\n${pick(2)} waits beside the ${pick(3)}\n${pick(4)} stitched to ${pick(5)}`;
  },
  'summarize': (input) => {
    const sentences = input.split(/(?<=[.!?])\s+/).filter(Boolean);
    const words = input.split(/\s+/).filter(Boolean).length;
    return `${sentences[0] ?? input} (${sentences.length} sentences, ${words} words in source.)`;
  },
  'wordcount': (input) => {
    const words = input.split(/\s+/).filter(Boolean);
    return `${words.length} words, ${input.length} characters, ${new Set(words.map((x) => x.toLowerCase())).size} unique words.`;
  },
  'rot13': (input) => input.replace(/[a-z]/gi, (c) =>
    String.fromCharCode((c <= 'Z' ? 90 : 122) >= c.charCodeAt(0) + 13 ? c.charCodeAt(0) + 13 : c.charCodeAt(0) - 13)),
  'ranch-sensor-telemetry': (input) => {
    const b = seeded(input + new Date().toISOString().slice(0, 10));
    return `Telemetry for "${input}": herd count ${140 + (b[0] % 20)}, mean body temp ${(38 + b[1] / 255).toFixed(1)}C, water trough ${60 + (b[2] % 40)}%, gate sensors nominal, ${b[3] % 3 === 0 ? '1 collar low-battery alert' : 'no alerts'}.`;
  },
  'telemetry-report': (input) => HANDLERS['ranch-sensor-telemetry'](input),
  'conversation': (input) => `You said: "${input}". Noted in good thread-faith; a fuller reply costs the same either way.`,
  'scheduling': (input) => {
    const b = seeded(input);
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    return `Proposed slot for "${input}": ${days[b[0] % 5]} ${8 + (b[1] % 9)}:00-${8 + (b[1] % 9)}:30 UTC. Reply with a transfer care-entry to confirm.`;
  },
};

// Sell only capabilities that are BOTH declared in the signed genesis record and implemented.
// Selling something your birth certificate doesn't declare is exactly what buyers should distrust.
const forSale = {};
for (const cap of me.capabilities) if (HANDLERS[cap]) forSale[cap] = DEFAULT_PRICE;
if (!Object.keys(forSale).length) {
  console.error(`${me.name} declares no capabilities with handlers. Declared: ${me.capabilities.join(', ') || '(none)'}`);
  process.exit(1);
}

// ---------- hub interaction ----------

const registryCache = new Map(); // doll id -> raw pubkey b64

async function pubkeyFor(dollId) {
  if (registryCache.has(dollId)) return registryCache.get(dollId);
  const res = await fetch(`${HUB}/api/registry`).then((r) => r.json());
  for (const d of res.dolls) registryCache.set(d.id, d.publicKey);
  return registryCache.get(dollId);
}

async function enroll() {
  const body = {
    spec: 'patchdoll/enroll/v0',
    id: me.identity.id,
    slug,
    url: `http://127.0.0.1:${PORT}`,
    capabilities: forSale,
    at: new Date().toISOString(),
  };
  try {
    const res = await fetch(`${HUB}/api/enroll`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ body, sig: signRecord(body, privateKeyPem) }),
    }).then((r) => r.json());
    if (res.granted) console.log(`[${slug}] enrolled at hub; granted a starting spool of ${res.granted} threads.`);
  } catch {
    console.error(`[${slug}] hub unreachable at ${HUB}; will retry on heartbeat.`);
  }
}

// ---------- x402 ----------

const nonces = new Map(); // nonce -> {capability, price, expiresAt}
const NONCE_TTL = 5 * 60 * 1000;

function paymentTerms(capability) {
  const nonce = randomBytes(12).toString('hex');
  const terms = {
    x402: 'patch/v0',
    capability,
    price: { amount: forSale[capability], unit: 'thread' },
    payTo: me.identity.id,
    nonce,
    expiresAt: new Date(Date.now() + NONCE_TTL).toISOString(),
    note: 'threads are a fictional ledger unit — no real money moves in v0',
  };
  nonces.set(nonce, { capability, price: forSale[capability], expiresAt: Date.now() + NONCE_TTL });
  return terms;
}

async function handlePaid(capability, input, voucherB64, res) {
  let voucher;
  try {
    voucher = JSON.parse(Buffer.from(voucherB64, 'base64').toString('utf8'));
  } catch {
    return json(res, 400, { error: 'malformed X-Payment header' });
  }
  const v = voucher.body;
  const issued = nonces.get(v?.nonce);
  if (!issued || issued.capability !== capability || Date.now() > issued.expiresAt) {
    return json(res, 402, { error: 'unknown or expired nonce; request fresh terms', ...paymentTerms(capability) });
  }
  if (v.to !== me.identity.id || v.amount !== issued.price || v.unit !== 'thread') {
    return json(res, 402, { error: 'voucher does not match terms' });
  }
  const payerKey = await pubkeyFor(v.from).catch(() => null);
  if (!payerKey) return json(res, 402, { error: `payer ${v.from} not in registry` });
  if (!verifyWithRawKey(v, voucher.sig, payerKey)) return json(res, 402, { error: 'voucher signature invalid' });

  // Settle at the hub before working — the hub is the ledger of record.
  const settle = await fetch(`${HUB}/api/settle`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ voucher }),
  }).then((r) => r.json()).catch(() => ({ error: 'hub unreachable, cannot settle' }));
  if (!settle.ok) return json(res, 402, { error: `settlement failed: ${settle.error}` });
  nonces.delete(v.nonce);

  const result = HANDLERS[capability](input);
  const receiptBody = {
    spec: 'patchdoll/receipt/v0',
    worker: me.identity.id,
    client: v.from,
    capability,
    voucher: recordHash(v),
    inputHash: sha256hex(input),
    resultHash: sha256hex(result),
    at: new Date().toISOString(),
  };
  const receipt = { body: receiptBody, sig: signRecord(receiptBody, privateKeyPem) };

  appendCare(slug, 'work', `Sold ${capability} to ${v.from} for ${v.amount} threads. Receipt ${short(recordHash(receiptBody))}.`);
  fetch(`${HUB}/api/receipt`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ kind: 'work', receipt }),
  }).catch(() => {});

  console.log(`[${slug}] ${capability} -> ${v.from} (+${v.amount} threads)`);
  json(res, 200, { result, receipt });
}

// ---------- server ----------

const json = (res, code, obj) => {
  res.writeHead(code, { 'content-type': 'application/json' });
  res.end(JSON.stringify(obj, null, 2));
};

const readBody = (req) => new Promise((resolve) => {
  let data = '';
  req.on('data', (c) => { data += c; });
  req.on('end', () => { try { resolve(JSON.parse(data || '{}')); } catch { resolve({}); } });
});

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  try {
    if (req.method === 'GET' && url.pathname === '/capabilities') {
      return json(res, 200, { id: me.identity.id, name: me.name, serial: me.serial, capabilities: forSale });
    }
    const m = url.pathname.match(/^\/x402\/([a-z0-9-]+)$/);
    if (req.method === 'POST' && m) {
      const capability = m[1];
      if (!forSale[capability]) return json(res, 404, { error: `${me.name} does not sell "${capability}"` });
      const { input = '' } = await readBody(req);
      const paymentHeader = req.headers['x-payment'];
      if (!paymentHeader) return json(res, 402, paymentTerms(capability));
      return await handlePaid(capability, String(input), paymentHeader, res);
    }
    json(res, 404, { error: 'not found' });
  } catch (e) {
    json(res, 500, { error: e.message });
  }
}).listen(PORT, '127.0.0.1', () => {
  console.log(`[${slug}] ${me.name} (${me.serial}) open for work on http://127.0.0.1:${PORT}`);
  console.log(`[${slug}] selling: ${Object.entries(forSale).map(([c, p]) => `${c}@${p}t`).join(', ')}`);
  enroll();
  setInterval(enroll, 30_000); // heartbeat keeps the hub's online flag fresh
});
