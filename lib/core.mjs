// The Cybernetic Patch Dolls — shared core: identity, canonical records, quilts, care.

import {
  generateKeyPairSync,
  createHash,
  createPrivateKey,
  createPublicKey,
  sign as edSign,
  verify as edVerify,
} from 'node:crypto';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const DOLLS_DIR = join(ROOT, 'dolls');
export const REGISTRY = join(ROOT, 'registry.json');

// ---------- canonical JSON (stable key order, no whitespace) ----------

export function canonical(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
}

export const sha256hex = (data) => createHash('sha256').update(data).digest('hex');
export const recordHash = (record) => sha256hex(canonical(record));

// ---------- identity ----------

const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

export function newIdentity() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const pubDer = publicKey.export({ type: 'spki', format: 'der' });
  const rawPub = pubDer.subarray(pubDer.length - 32); // raw 32-byte key is the DER suffix
  const fingerprint = sha256hex(rawPub);
  return {
    publicKeyPem: publicKey.export({ type: 'spki', format: 'pem' }),
    privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }),
    publicKeyB64: rawPub.toString('base64'),
    fingerprint,
    id: `patch:ed25519:${fingerprint.slice(0, 16)}`,
  };
}

export const publicKeyFromRaw = (rawB64) =>
  createPublicKey({
    key: Buffer.concat([ED25519_SPKI_PREFIX, Buffer.from(rawB64, 'base64')]),
    format: 'der',
    type: 'spki',
  });

export const rawPubFromPem = (pem) =>
  createPublicKey(pem).export({ type: 'spki', format: 'der' }).subarray(-32);

export const signRecord = (record, privateKeyPem) =>
  edSign(null, Buffer.from(canonical(record)), createPrivateKey(privateKeyPem)).toString('base64');

export const verifyRecord = (record, sigB64, publicKeyPemOrObj) =>
  edVerify(
    null,
    Buffer.from(canonical(record)),
    typeof publicKeyPemOrObj === 'string' ? createPublicKey(publicKeyPemOrObj) : publicKeyPemOrObj,
    Buffer.from(sigB64, 'base64'),
  );

export const verifyWithRawKey = (record, sigB64, rawPubB64) =>
  verifyRecord(record, sigB64, publicKeyFromRaw(rawPubB64));

// ---------- quilt identicon ----------
// 6x6 quilt, horizontally mirrored. Every visual choice derives from the
// identity fingerprint, so the quilt IS the public key.

export const PALETTE = [
  '#b5533c', '#d9975b', '#c9b458', '#6f8f5f',
  '#4f7d8c', '#5b6a94', '#8a6a8f', '#a06060',
];
// Backing cloth and stitch color. Neutral by design: the eight PALETTE hues encode the
// key and must be the only chromatic events on the page.
export const CLOTH = '#f7f6f3';

export function quiltSvg(fingerprint, size = 240, opts = {}) {
  const { animated = false } = opts;
  const bytes = Buffer.from(fingerprint, 'hex');
  const cells = 6;
  const cell = size / cells;
  // Wrap each patch when animating so external CSS can stagger reveal.
  // Delay is (row + col) so patches wash in as a top-left to bottom-right sweep.
  const wrap = (shape, row, col) => animated
    ? `<g class="patch" style="--i:${row + col}">${shape}</g>`
    : shape;
  let shapes = '';
  for (let row = 0; row < cells; row++) {
    for (let col = 0; col < 3; col++) {
      const b = bytes[(row * 3 + col) % bytes.length];
      const b2 = bytes[(row * 3 + col + 13) % bytes.length];
      const color = PALETTE[b % PALETTE.length];
      const color2 = PALETTE[b2 % PALETTE.length];
      const pattern = b >> 6;
      for (const c of [col, cells - 1 - col]) {
        const x = c * cell;
        const y = row * cell;
        shapes += wrap(patchShape(x, y, cell, color, color2, pattern, c >= cells / 2), row, c);
      }
    }
  }
  let stitches = '';
  for (let i = 1; i < cells; i++) {
    const p = i * cell;
    stitches += `<line x1="${p}" y1="0" x2="${p}" y2="${size}" class="stitch"/>`;
    stitches += `<line x1="0" y1="${p}" x2="${size}" y2="${p}" class="stitch"/>`;
  }
  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="quilt identicon">
<style>.stitch{stroke:${CLOTH};stroke-width:2;stroke-dasharray:4 3;opacity:.85}</style>
<rect width="${size}" height="${size}" fill="${CLOTH}"/>
${shapes}${stitches}
<rect width="${size}" height="${size}" fill="none" stroke="${CLOTH}" stroke-width="6"/>
</svg>`;
}

function patchShape(x, y, s, color, color2, pattern, flip) {
  const base = `<rect x="${x}" y="${y}" width="${s}" height="${s}" fill="${color}"/>`;
  switch (pattern) {
    case 0:
      return base;
    case 1: {
      const tri = flip
        ? `M${x},${y} L${x + s},${y} L${x},${y + s} Z`
        : `M${x + s},${y} L${x + s},${y + s} L${x},${y} Z`;
      return base + `<path d="${tri}" fill="${color2}"/>`;
    }
    case 2: {
      const m = s * 0.25;
      return base + `<rect x="${x + m}" y="${y + m}" width="${s - 2 * m}" height="${s - 2 * m}" fill="${color2}"/>`;
    }
    default:
      return base + `<circle cx="${x + s / 2}" cy="${y + s / 2}" r="${s * 0.22}" fill="${color2}"/>`;
  }
}

// ---------- registry & dolls ----------

export function loadRegistry() {
  if (!existsSync(REGISTRY)) return { spec: 'patchdoll/registry/v0', dolls: [] };
  return JSON.parse(readFileSync(REGISTRY, 'utf8'));
}

export function saveRegistry(reg) {
  writeFileSync(REGISTRY, JSON.stringify(reg, null, 2) + '\n');
}

export function loadDoll(slug) {
  const dir = join(DOLLS_DIR, slug);
  if (!existsSync(dir)) throw new Error(`No doll at dolls/${slug}`);
  return {
    dir,
    slug,
    genesis: JSON.parse(readFileSync(join(dir, 'genesis.json'), 'utf8')),
    care: JSON.parse(readFileSync(join(dir, 'care-record.json'), 'utf8')),
    publicKeyPem: readFileSync(join(dir, 'keys', 'public.pem'), 'utf8'),
  };
}

// Private keys are deliberately not published with this repository — a doll's body holds
// its own key. Records that ship here are verifiable by anyone, signable by nobody.
export const loadPrivateKey = (slug) => {
  const path = join(DOLLS_DIR, slug, 'keys', 'private.pem');
  if (!existsSync(path)) {
    throw new Error(
      `No private key for "${slug}". Published dolls ship their public records only, so they ` +
      `can be verified but not acted for. Birth your own to run a floor:\n` +
      `  node bin/patchdoll.mjs birth --name "Clover Bobbin" --capabilities "haiku,summarize"`,
    );
  }
  return readFileSync(path, 'utf8');
};

export function allDolls() {
  return loadRegistry().dolls.map((d) => {
    try {
      return loadDoll(d.slug);
    } catch {
      return null;
    }
  }).filter(Boolean);
}

// ---------- care record ----------

export function careEntry(seq, type, note, prevHash, privateKeyPem) {
  const body = { seq, at: new Date().toISOString(), type, note, prev: prevHash };
  return { body, sig: signRecord(body, privateKeyPem) };
}

export function appendCare(slug, type, note) {
  const { dir, genesis, care } = loadDoll(slug);
  const privateKeyPem = loadPrivateKey(slug);
  const last = care.entries[care.entries.length - 1];
  const prev = last ? recordHash(last.body) : recordHash(genesis.record);
  const entry = careEntry((last?.body.seq ?? -1) + 1, type, note, prev, privateKeyPem);
  care.entries.push(entry);
  writeFileSync(join(dir, 'care-record.json'), JSON.stringify(care, null, 2) + '\n');
  return entry;
}

// ---------- misc ----------

export function esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

export const short = (hashOrId) => String(hashOrId).replace(/^sha256:/, '').slice(0, 8);
