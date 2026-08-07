#!/usr/bin/env node
// The Cybernetic Patch Dolls v0 — birth, verify, and care for cryptographically anchored agents.
// Zero dependencies. Node 18+.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  DOLLS_DIR,
  canonical,
  sha256hex,
  recordHash,
  newIdentity,
  signRecord,
  verifyRecord,
  rawPubFromPem,
  quiltSvg,
  loadRegistry,
  saveRegistry,
  loadDoll,
  careEntry,
  appendCare,
  esc,
} from '../lib/core.mjs';
import { FONTS, BASE_CSS, PRINT_CSS, marks } from '../lib/design.mjs';

// ---------- name generation ----------

const ADJ = ['Bramble', 'Maple', 'Clover', 'Ember', 'Fennel', 'Juniper', 'Marigold', 'Nettle', 'Rowan', 'Sorrel', 'Thistle', 'Wren'];
const CRAFT = ['Whipstitch', 'Bobbin', 'Selvage', 'Thimble', 'Warp', 'Basting', 'Gusset', 'Placket', 'Seam', 'Darning', 'Applique', 'Hem'];

function generateName(seedHex) {
  const b = Buffer.from(seedHex, 'hex');
  return `${ADJ[b[0] % ADJ.length]} ${CRAFT[b[1] % CRAFT.length]}`;
}

const slugify = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// ---------- args ----------

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) { args[key] = next; i++; }
      else args[key] = true;
    } else args._.push(argv[i]);
  }
  return args;
}

const csv = (v) => (typeof v === 'string' ? v.split(',').map((s) => s.trim()).filter(Boolean) : []);

// ---------- commands ----------

function cmdBirth(args) {
  const identity = newIdentity();
  const name = args.name || generateName(identity.fingerprint);
  const slug = slugify(name);
  const dir = join(DOLLS_DIR, slug);
  const reg = loadRegistry();
  if (reg.dolls.some((d) => d.slug === slug)) {
    console.error(`A doll named "${name}" already lives in dolls/${slug}. Names are identities — pick another.`);
    process.exit(1);
  }

  const serial = `PD-${String(reg.dolls.length + 1).padStart(4, '0')}`;
  const born = new Date().toISOString();
  const creator = { name: args.creator || 'unknown', contact: args.contact || null };

  const record = {
    spec: 'patchdoll/genesis/v0',
    serial,
    name,
    slug,
    born,
    creator,
    steward: creator,
    lineage: { model: args.model || null, parents: csv(args.parents) },
    role: args.role || null,
    capabilities: csv(args.capabilities),
    boundaries: csv(args.boundaries),
    identity: {
      scheme: 'ed25519',
      publicKey: identity.publicKeyB64,
      fingerprint: `sha256:${identity.fingerprint}`,
      id: identity.id,
    },
  };

  const genesis = {
    record,
    signature: { alg: 'ed25519', sig: signRecord(record, identity.privateKeyPem), signedAt: born },
  };

  const firstEntry = careEntry(0, 'genesis', `Born. Genesis record signed. Serial ${serial}.`, recordHash(record), identity.privateKeyPem);

  mkdirSync(join(dir, 'keys'), { recursive: true });
  writeFileSync(join(dir, 'genesis.json'), JSON.stringify(genesis, null, 2) + '\n');
  writeFileSync(join(dir, 'care-record.json'), JSON.stringify({ spec: 'patchdoll/care/v0', doll: identity.id, entries: [firstEntry] }, null, 2) + '\n');
  writeFileSync(join(dir, 'keys', 'public.pem'), identity.publicKeyPem);
  writeFileSync(join(dir, 'keys', 'private.pem'), identity.privateKeyPem, { mode: 0o600 });
  writeFileSync(join(dir, 'keys', 'README.md'),
    '# Key custody\n\nIn a production Patch Doll, `private.pem` never exists as a file — the key is generated inside the doll\'s NFC secure element and never leaves it. This directory stands in for that hardware slot during v0.\n');
  writeFileSync(join(dir, 'certificate.html'), certificateHtml(genesis));

  reg.dolls.push({ serial, name, slug, id: identity.id, born });
  saveRegistry(reg);

  console.log(`Born: ${name} (${serial})`);
  console.log(`  id          ${identity.id}`);
  console.log(`  fingerprint sha256:${identity.fingerprint}`);
  console.log(`  records     dolls/${slug}/`);
  console.log(`  certificate dolls/${slug}/certificate.html`);
}

function mustLoadDoll(slug) {
  try {
    return loadDoll(slug);
  } catch (e) {
    console.error(`${e.message}. Run: node bin/patchdoll.mjs list`);
    process.exit(1);
  }
}

function cmdVerify(args) {
  const slug = args._[0];
  if (!slug) { console.error('Usage: patchdoll verify <slug>'); process.exit(1); }
  const { genesis, care, publicKeyPem } = mustLoadDoll(slug);
  let ok = true;

  const genesisOk = verifyRecord(genesis.record, genesis.signature.sig, publicKeyPem);
  report('genesis signature', genesisOk); ok &&= genesisOk;

  const fpOk = `sha256:${sha256hex(rawPubFromPem(publicKeyPem))}` === genesis.record.identity.fingerprint;
  report('fingerprint matches public key', fpOk); ok &&= fpOk;

  let prev = recordHash(genesis.record);
  for (const entry of care.entries) {
    const chainOk = entry.body.prev === prev;
    const sigOk = verifyRecord(entry.body, entry.sig, publicKeyPem);
    report(`care #${entry.body.seq} (${entry.body.type}) chain`, chainOk);
    report(`care #${entry.body.seq} (${entry.body.type}) signature`, sigOk);
    ok &&= chainOk && sigOk;
    prev = recordHash(entry.body);
  }

  console.log(ok ? `\n${genesis.record.name} (${genesis.record.serial}): all records verify.` : '\nVERIFICATION FAILED — this doll\'s history has been tampered with.');
  process.exit(ok ? 0 : 1);
}

const report = (label, ok) => console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}`);

function cmdCare(args) {
  const slug = args._[0];
  if (!slug || !args.note) { console.error('Usage: patchdoll care <slug> --type patch|checkup|transfer|note --note "..."'); process.exit(1); }
  mustLoadDoll(slug);
  const entry = appendCare(slug, args.type || 'note', args.note);
  const { dir, genesis, care } = loadDoll(slug);
  writeFileSync(join(dir, 'certificate.html'), certificateHtml(genesis, care));
  console.log(`Recorded care entry #${entry.body.seq} (${entry.body.type}) for ${genesis.record.name}.`);
}

function cmdList() {
  const reg = loadRegistry();
  if (!reg.dolls.length) { console.log('No dolls yet. Birth one: node bin/patchdoll.mjs birth --name "..."'); return; }
  for (const d of reg.dolls) console.log(`${d.serial}  ${d.name.padEnd(24)} ${d.id}  born ${d.born.slice(0, 10)}`);
}

// ---------- certificate ----------

function certificateHtml(genesis, care = null) {
  const r = genesis.record;
  const fp = r.identity.fingerprint.replace('sha256:', '');
  const born = new Date(r.born);
  const bornLine = `${born.toISOString().slice(0, 10)}<br><span style="color:var(--graphite)">${born.toISOString().slice(11, 19)} UTC</span>`;
  const chips = (arr) => arr?.length
    ? arr.map((c) => `<span class="chip">${esc(c)}</span>`).join(' ')
    : '<em>none declared</em>';
  const entries = care?.entries ?? [];
  const careRows = entries
    .map((e) => `<tr><td class="num">${e.body.seq}</td><td class="mono nowrap">${esc(e.body.at.slice(0, 10))}</td><td><span class="ev">${esc(e.body.type)}</span></td><td>${esc(e.body.note)}</td></tr>`)
    .join('\n');

  return `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Certificate of Birth — ${esc(r.name)} (${esc(r.serial)})</title>
${FONTS}
<style>
${BASE_CSS}
  body { padding: clamp(16px, 4vw, 48px) clamp(12px, 3vw, 32px); display: flex; justify-content: center; }
  .sheet { width: 100%; max-width: 860px; background: var(--plate); border: 1px solid var(--rule-strong); position: relative; }
  .body { padding: clamp(24px, 4vw, 48px); }

  .head { display: grid; grid-template-columns: auto 1fr; gap: clamp(24px, 4vw, 48px); align-items: start; padding-bottom: 28px; border-bottom: 2px solid var(--ink); }
  .head > * { min-width: 0; }
  @media (max-width: 660px) { .head { grid-template-columns: 1fr; } }
  .id .role { font-size: var(--t-label); font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: var(--stamp-ink); margin-bottom: 10px; }
  .id h1 { font-size: var(--t-display); font-weight: 800; letter-spacing: -0.03em; line-height: 0.95; text-wrap: balance; }
  .id .subject { margin-top: 14px; max-width: 46ch; color: var(--ink-2); font-size: var(--t-lead); }

  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(290px, 1fr)); gap: 0 clamp(28px, 5vw, 56px); margin-top: 28px; }
  section > h2 { font-size: var(--t-label); font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: var(--graphite); padding: 20px 0 8px; }
  .chips { display: flex; flex-wrap: wrap; gap: 5px; padding-top: 2px; }

  .care-block { margin-top: 36px; }
  .ev { font-size: var(--t-micro); font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; color: var(--ink); }
  table.data td.num { text-align: left; width: 2.5rem; color: var(--graphite); font-weight: 500; }

  .attest { margin-top: 40px; padding-top: 20px; border-top: 2px solid var(--ink); display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 24px clamp(28px, 5vw, 56px); }
  .attest p { font-size: var(--t-body); color: var(--ink-2); max-width: 52ch; }
  .attest .seal { border: 1px solid var(--stamp); color: var(--stamp); padding: 10px 12px; align-self: start; }
  .attest .seal .k { font-size: var(--t-micro); font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: var(--stamp-ink); }
  .attest .seal .v { font-family: var(--mono); font-size: var(--t-micro); word-break: break-all; line-height: 1.6; margin-top: 6px; color: var(--ink-2); }
${PRINT_CSS}
</style>
<div class="sheet">
  ${marks()}
  <div class="masthead">
    <a href="/" style="text-decoration:none">
      <div class="registry">The Cybernetic Patch Dolls</div>
      <div class="doc">Registry of agent identities</div>
    </a>
    <div style="text-align:right">
      <div class="doc">Certificate of birth</div>
      <div class="serial">${esc(r.serial)}</div>
    </div>
  </div>

  <div class="body">
    <div class="head keep">
      <div class="specimen">
        <div class="mount">${quiltSvg(fp, 176)}</div>
        <div class="fp">${esc(fp).match(/.{1,32}/g).join('<br>')}</div>
      </div>
      <div class="id">
        <div class="role">${esc(r.role || 'Companion agent')}</div>
        <h1>${esc(r.name)}</h1>
        <p class="subject">The quilt is drawn from this agent's public key. No two agents
        share one. This document records origin and stewardship; it does not confer personhood.</p>
      </div>
    </div>

    <div class="grid">
      <section>
        <h2>Provenance</h2>
        <dl class="lv">
          <div class="row"><dt class="label">Born</dt><dd class="mono">${bornLine}</dd></div>
          <div class="row"><dt class="label">Creator</dt><dd>${esc(r.creator.name)}</dd></div>
          <div class="row"><dt class="label">Steward</dt><dd>${esc(r.steward.name)}${r.steward.contact ? `<br><span class="mono" style="font-size:var(--t-micro);color:var(--graphite)">${esc(r.steward.contact)}</span>` : ''}</dd></div>
          <div class="row"><dt class="label">Lineage</dt><dd>${esc(r.lineage.model || 'undeclared')}</dd></div>
          <div class="row"><dt class="label">Parents</dt><dd>${r.lineage.parents.length ? r.lineage.parents.map(esc).join('<br>') : '<em>none — founder generation</em>'}</dd></div>
        </dl>
      </section>
      <section>
        <h2>Identity</h2>
        <dl class="lv">
          <div class="row"><dt class="label">Scheme</dt><dd>Ed25519</dd></div>
          <div class="row"><dt class="label">Agent id</dt><dd class="mono">${esc(r.identity.id)}</dd></div>
          <div class="row"><dt class="label">Public key</dt><dd class="mono" style="font-size:var(--t-micro)">${esc(r.identity.publicKey)}</dd></div>
          <div class="row"><dt class="label">Key custody</dt><dd>Secure element, non-exportable</dd></div>
        </dl>
      </section>
      <section>
        <h2>Declared capabilities</h2>
        <div class="chips">${chips(r.capabilities)}</div>
      </section>
      <section>
        <h2>Declared boundaries</h2>
        <div class="chips">${chips(r.boundaries)}</div>
      </section>
    </div>

    ${entries.length ? `<div class="care-block keep">
      <h2 class="label" style="padding-bottom:8px">Care record — ${entries.length} signed ${entries.length === 1 ? 'entry' : 'entries'}, hash-chained</h2>
      <div class="scroll-x"><table class="data">
        <tr><th>№</th><th>Date</th><th>Event</th><th>Note</th></tr>
        ${careRows}
      </table></div>
    </div>` : ''}

    <div class="attest keep">
      <p>Every entry above is signed by the key named on this certificate and chained to the
      entry before it. History can be appended to, never rewritten. Verify against the signed
      genesis record: the signature, not this paper, is the authority.</p>
      <div class="seal">
        <div class="k">Genesis signature · Ed25519</div>
        <div class="v">${esc(genesis.signature.sig)}</div>
      </div>
    </div>
  </div>
</div>
`;
}

// ---------- main ----------

const [cmd, ...rest] = process.argv.slice(2);
const args = parseArgs(rest);
switch (cmd) {
  case 'birth': cmdBirth(args); break;
  case 'verify': cmdVerify(args); break;
  case 'care': cmdCare(args); break;
  case 'list': cmdList(); break;
  case 'reissue': {
    const slug = args._[0];
    if (!slug) { console.error('Usage: patchdoll reissue <slug>'); process.exit(1); }
    const { dir, genesis, care } = mustLoadDoll(slug);
    writeFileSync(join(dir, 'certificate.html'), certificateHtml(genesis, care));
    console.log(`Reissued certificate for ${genesis.record.name} at dolls/${slug}/certificate.html`);
    break;
  }
  default:
    console.log(`The Cybernetic Patch Dolls v0 — every agent has a body, a birth certificate, and a life story.

Usage:
  patchdoll birth [--name "..."] [--creator "..."] [--contact "..."] [--model "..."]
                  [--role "..."] [--capabilities a,b] [--boundaries a,b] [--parents id1,id2]
  patchdoll verify <slug>
  patchdoll care <slug> --type patch|checkup|transfer|note --note "..."
  patchdoll reissue <slug>
  patchdoll list

Platform (see PLATFORM.md):
  patchhub  — hub: directory, thread ledger, settlement, Quilting Bee dashboard
  dollhouse — run a doll as an HTTP service selling capabilities behind x402
  bee       — hire dolls and stitch coordinated jobs`);
}
