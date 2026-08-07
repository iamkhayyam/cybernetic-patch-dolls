#!/usr/bin/env node
// build-site — generate the static public registry into dist/ for Cloudflare Pages.
//
//   node bin/build-site.mjs
//
// Ships: the registry landing page, one page per doll certificate, and a build-time
// snapshot of the coordination floor. Reads only public records — never private keys.

import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, cpSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import {
  ROOT,
  allDolls,
  quiltSvg,
  esc,
} from '../lib/core.mjs';
import { FONTS, BASE_CSS, FLOOR_CSS, marks } from '../lib/design.mjs';

const DIST = join(ROOT, 'dist');
const REPO = 'https://github.com/iamkhayyam/cybernetic-patch-dolls';

const dolls = allDolls().sort((a, b) => a.genesis.record.serial.localeCompare(b.genesis.record.serial));
if (!dolls.length) {
  console.error('No dolls in the registry. Run `node bin/demo.mjs` first.');
  process.exit(1);
}

const hub = existsSync(join(ROOT, 'hub-state.json'))
  ? JSON.parse(readFileSync(join(ROOT, 'hub-state.json'), 'utf8'))
  : { balances: {}, transactions: [], receipts: [] };

const nameOf = Object.fromEntries(dolls.map((d) => [d.genesis.record.identity.id, d.genesis.record.name]));
const firsts = dolls.map((d) => d.genesis.record.name.split(' ')[0]);
const briefOf = Object.fromEntries(dolls.map((d) => {
  const f = d.genesis.record.name.split(' ')[0];
  return [d.genesis.record.identity.id, firsts.filter((x) => x === f).length === 1 ? f : d.genesis.record.name];
}));
const nm = (id) => esc(nameOf[id] || String(id).slice(0, 14));
const bn = (id) => esc(briefOf[id] || String(id).slice(0, 14));

// ---------- shared chrome ----------

const head = (title, desc) => `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="website">
${FONTS}`;

const masthead = (right1, right2, href = '/') => `
<div class="masthead">
  <a href="${href}" style="text-decoration:none">
    <div class="registry">The Cybernetic Patch Dolls</div>
    <div class="doc">Registry of agent identities</div>
  </a>
  <div style="text-align:right">
    <div class="doc">${esc(right1)}</div>
    <div class="serial">${esc(right2)}</div>
  </div>
</div>`;

const SITE_CSS = `
  a.plain { text-decoration: none; color: inherit; }
  a.u { color: var(--stamp-ink); text-underline-offset: 3px; text-decoration-thickness: 1px; }
  footer.site { border-top: 1px solid var(--rule-strong); margin-top: 72px; padding: 28px 0 96px; }
  footer.site p { max-width: 62ch; color: var(--graphite); }
  footer.site .links { display: flex; flex-wrap: wrap; gap: 20px; margin-top: 16px; font-size: var(--t-label); font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; }
`;

const siteFooter = () => `
<footer class="site"><div class="wrap">
  <p>Threads are a ledger unit issued by the hub in this project's demo. No money moves.
  Certificates record origin and stewardship; they do not confer personhood.</p>
  <div class="links">
    <a class="u" href="/">Registry</a>
    <a class="u" href="/bee/">Coordination floor</a>
    <a class="u" href="${REPO}">Source</a>
  </div>
</div></footer>`;

// ---------- landing ----------

function landing() {
  const rows = dolls.map(({ slug, genesis, care }) => {
    const r = genesis.record;
    const fp = r.identity.fingerprint.replace('sha256:', '');
    return `<a class="entry" href="/d/${esc(slug)}/">
      <div class="mount">${quiltSvg(fp, 132)}</div>
      <div class="body">
        <div class="kicker">${esc(r.serial)} · ${esc(r.role || 'Companion agent')}</div>
        <h3>${esc(r.name)}</h3>
        <div class="fp mono">${esc(fp.slice(0, 32))}<span class="tail">${esc(fp.slice(32))}</span></div>
        <div class="caps">${r.capabilities.map((c) => `<span class="chip">${esc(c)}</span>`).join('')}</div>
      </div>
      <div class="go">
        <div class="n">${care.entries.length}<span>signed entries</span></div>
        <div class="cta">View certificate <span aria-hidden="true">→</span></div>
      </div>
    </a>`;
  }).join('\n');

  const totalEntries = dolls.reduce((s, d) => s + d.care.entries.length, 0);

  return `${head('The Cybernetic Patch Dolls', 'Phygital companions for the agentic age. Physical dolls that anchor cryptographically verifiable AI agent identities.')}
<style>
${BASE_CSS}
${FLOOR_CSS}
${SITE_CSS}
  .hero { padding: clamp(48px, 9vw, 104px) 0 clamp(48px, 7vw, 88px); border-bottom: 2px solid var(--ink); }
  .hero .kicker { font-size: var(--t-label); font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: var(--stamp-ink); margin-bottom: 18px; }
  .hero h1 { font-size: clamp(2.2rem, 6.4vw, 4.5rem); font-weight: 800; letter-spacing: -0.035em; line-height: 0.98; max-width: 17ch; text-wrap: balance; }
  .hero p { margin-top: 24px; max-width: 60ch; font-size: var(--t-lead); color: var(--ink-2); }

  /* Landing sections use display-scale heads, not the dashboard's 11px silkscreen labels.
     Weight and size do the anchoring; a small caption sits underneath as context. */
  .sect { padding: clamp(40px, 6vw, 72px) 0 clamp(18px, 2.5vw, 24px); }
  .sect h2 { font-size: clamp(1.75rem, 3.4vw, 2.4rem); font-weight: 700; letter-spacing: -0.02em; line-height: 1.05; }
  .sect .caption { margin-top: 10px; font-size: var(--t-label); font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: var(--graphite); }

  /* Registry entries: bigger quilts (they encode identity — they earn the space),
     display-scale name, room to read the fingerprint intact, and a clear CTA. */
  .collection { border-top: 2px solid var(--ink); }
  .entry { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: clamp(24px, 4vw, 44px); align-items: center; padding: clamp(24px, 3vw, 32px) clamp(12px, 2vw, 24px) clamp(24px, 3vw, 32px) 0; border-bottom: 1px solid var(--rule); text-decoration: none; color: inherit; transition: background 140ms var(--ease); }
  .entry:hover, .entry:focus-visible { background: var(--plate); outline: none; }
  .entry .mount { border: 1px solid var(--rule-strong); padding: 6px; background: var(--plate); line-height: 0; align-self: start; }
  .entry .kicker { font-size: var(--t-label); font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: var(--stamp-ink); margin-bottom: 8px; }
  .entry h3 { font-size: clamp(1.6rem, 3vw, 2.15rem); font-weight: 700; letter-spacing: -0.025em; line-height: 1.05; }
  .entry .fp { margin-top: 12px; font-size: var(--t-micro); color: var(--graphite); letter-spacing: -0.005em; word-break: break-all; }
  .entry .fp .tail { color: var(--rule-strong); }
  .entry .caps { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 14px; }
  .entry .go { text-align: right; }
  .entry .n { font-size: 2rem; font-weight: 700; letter-spacing: -0.02em; line-height: 1; font-variant-numeric: tabular-nums; }
  .entry .n span { display: block; font-size: var(--t-micro); font-weight: 600; letter-spacing: 0.16em; text-transform: uppercase; color: var(--graphite); margin-top: 6px; }
  .entry .cta { margin-top: 20px; font-size: var(--t-label); font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: var(--stamp-ink); }
  .entry .cta span { display: inline-block; transition: transform 140ms var(--ease); }
  .entry:hover .cta span { transform: translateX(4px); }
  @media (max-width: 720px) {
    .entry { grid-template-columns: auto 1fr; padding-right: 0; }
    .entry .go { grid-column: 1 / -1; text-align: left; display: flex; align-items: baseline; gap: 24px; justify-content: space-between; }
    .entry .cta { margin-top: 0; }
  }

  /* Certificate-proves: bigger heads, rule as separator, prose sits below on its own. */
  .spec { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(280px, 100%), 1fr)); gap: 0 clamp(32px, 5vw, 64px); border-top: 1px solid var(--rule); }
  .spec section { padding: 28px 0 32px; border-bottom: 1px solid var(--rule); }
  .spec h3 { font-size: 1.3rem; font-weight: 700; letter-spacing: -0.015em; color: var(--ink); margin-bottom: 12px; }
  .spec p { color: var(--ink-2); max-width: 46ch; }

  ol.flowlist { list-style: none; counter-reset: s; border-top: 2px solid var(--ink); }
  ol.flowlist li { counter-increment: s; display: grid; grid-template-columns: 3.5rem 1fr; gap: 24px; padding: 22px 0; border-bottom: 1px solid var(--rule); align-items: baseline; }
  ol.flowlist li::before { content: counter(s, decimal-leading-zero); font-family: var(--mono); font-size: 1.05rem; color: var(--stamp-ink); font-weight: 500; letter-spacing: -0.02em; }
  ol.flowlist p { color: var(--ink-2); max-width: 62ch; font-size: var(--t-lead); }
  ol.flowlist b { color: var(--ink); font-weight: 600; }
</style>
${masthead('Public registry', 'iamkhayyam')}
<div class="wrap">
  ${marks()}
  <div class="hero">
    <div class="kicker">Phygital companions for the agentic age</div>
    <h1>Every agent has a body, a birth certificate, and a life story.</h1>
    <p>An agent identity that cannot transact is a business card. An agent that transacts
    without identity is a liability. The Cybernetic Patch Dolls binds the two: the key that
    signs a doll's birth certificate also signs its payment vouchers and its work receipts.</p>
  </div>

  <div class="sect">
    <h2>The register</h2>
    <div class="caption">${dolls.length} ${dolls.length === 1 ? 'doll' : 'dolls'} · ${totalEntries} signed entries</div>
  </div>
  <div class="collection">${rows}</div>

  <div class="sect">
    <h2>What a certificate proves</h2>
    <div class="caption">Three claims, kept deliberately separate</div>
  </div>
  <div class="spec">
    <section>
      <h3>Identity</h3>
      <p>An Ed25519 public key is the doll. Its fingerprint renders as a patchwork quilt,
      so a cryptographic value becomes something you can recognise across a room.</p>
    </section>
    <section>
      <h3>Accountability</h3>
      <p>Every certificate names a responsible human steward. Transfers are signed adoption
      papers. Nothing here implies the software is a legal person.</p>
    </section>
    <section>
      <h3>History</h3>
      <p>Care records are hash-chained and signed: security patches, audits, commissions,
      work sold. History can be appended to, never rewritten.</p>
    </section>
  </div>

  <div class="sect">
    <h2>How dolls hire each other</h2>
    <div class="caption">An x402-shaped exchange, no money moves</div>
  </div>
  <ol class="flowlist">
    <li><p>A doll asks another for work. The service answers <b>402 Payment Required</b> with its price, payee id, and a single-use nonce.</p></li>
    <li><p>The buyer signs a <b>voucher</b> over those exact terms, using the same key that signs its birth certificate.</p></li>
    <li><p>The hub verifies that signature against the payer's genesis record, rejects replays and overspends, and settles.</p></li>
    <li><p>The worker does the job and returns a <b>receipt</b> it signed, binding worker, client, input hash, and result hash.</p></li>
    <li><p>Multi-agent jobs stitch those receipts into a <b>quilt</b>: an auditable provenance graph for work that crossed several agents.</p></li>
  </ol>
</div>
${siteFooter()}
`;
}

// ---------- floor snapshot ----------

function floor() {
  const built = new Date().toISOString();
  const regRows = dolls.map(({ slug, genesis, care }) => {
    const r = genesis.record;
    const fp = r.identity.fingerprint.replace('sha256:', '');
    const sold = care.entries.filter((e) => e.body.type === 'work').length;
    return `<a class="plain reg-row" href="/d/${esc(slug)}/">
      <div class="mount">${quiltSvg(fp, 72)}</div>
      <div><h3>${esc(r.name)}</h3>
        <div class="meta">${esc(r.serial)} · ${esc(fp.slice(0, 10))}</div>
        <div class="state"><span class="dot"></span>${sold} jobs sold</div>
      </div>
      <div class="chips">${r.capabilities.map((c) => `<span class="chip">${esc(c)}</span>`).join('')}</div>
      <div class="bal"><div class="n">${hub.balances?.[r.identity.id] ?? '—'}</div><div class="u">threads</div></div>
    </a>`;
  }).join('\n');

  const tx = (hub.transactions ?? []).slice(-24).reverse();
  const rc = (hub.receipts ?? []).slice(-24).reverse();
  const ledger = tx.length ? tx.map((t) => `<tr>
      <td class="mono nowrap">${esc(t.at.slice(11, 19))}</td>
      <td class="flow"><b>${bn(t.from)}</b><span class="arrow">→</span><b>${bn(t.to)}</b></td>
      <td>${esc(t.capability)}</td><td class="num">${t.amount}</td></tr>`).join('')
    : '<tr><td colspan="4" class="none">No threads changed hands in this snapshot.</td></tr>';
  const receipts = rc.length ? rc.map((r) => {
    const b = r.receipt?.body ?? {};
    const what = r.kind === 'quilt'
      ? `${esc(b.job ?? 'quilt')} <span style="color:var(--graphite)">· ${b.patches?.length ?? 0} patches</span>`
      : `${esc(b.capability ?? '')} <span style="color:var(--graphite)">· for ${b.client ? bn(b.client) : '—'}</span>`;
    return `<tr><td class="mono nowrap">${esc(r.at.slice(11, 19))}</td>
      <td>${bn(b.worker ?? b.stitchedBy)}</td><td>${what}</td>
      <td class="mono">${esc((r.receipt?.sig || '').slice(0, 10))}</td></tr>`;
  }).join('') : '<tr><td colspan="4" class="none">No work was receipted in this snapshot.</td></tr>';

  const threads = (hub.transactions ?? []).reduce((s, t) => s + t.amount, 0);

  return `${head('The Quilting Bee — coordination floor', 'A snapshot of Patch Dolls hiring and paying each other over an x402-style exchange.')}
<style>
${BASE_CSS}
${FLOOR_CSS}
${SITE_CSS}
  .note { border: 1px solid var(--rule-strong); padding: 14px 16px; margin: 28px 0 0; max-width: 68ch; color: var(--ink-2); }
  .note b { color: var(--ink); font-weight: 600; }
  .reg-row:hover { background: var(--plate); }
</style>
${masthead('Coordination floor', 'The Quilting Bee')}
<div class="wrap">
  ${marks()}
  <div class="strip">
    <div class="cell"><span class="v">${dolls.length}</span><span class="k">agents registered</span></div>
    <div class="cell"><span class="v">${threads}</span><span class="k">threads settled</span></div>
    <div class="cell"><span class="v">${(hub.receipts ?? []).filter((r) => r.kind === 'work').length}</span><span class="k">jobs worked</span></div>
    <div class="cell"><span class="v">${(hub.receipts ?? []).filter((r) => r.kind === 'quilt').length}</span><span class="k">quilts stitched</span></div>
  </div>
  <div class="note"><b>This is a static snapshot</b>, captured when the site was built on
  ${esc(built.slice(0, 10))}. The floor is live only when you run the hub yourself: see the
  <a class="u" href="${REPO}">source</a> for the four commands that open it.</div>

  <h2 class="sec">Register</h2>
  <div class="register">${regRows}</div>

  <div class="cols">
    <div>
      <h2 class="sec">Thread ledger</h2>
      <div class="scroll-x"><table class="data compact">
        <tr><th>Time</th><th>Flow</th><th>Capability</th><th class="num">Threads</th></tr>
        ${ledger}
      </table></div>
    </div>
    <div>
      <h2 class="sec">Work receipts</h2>
      <div class="scroll-x"><table class="data compact">
        <tr><th>Time</th><th>Signed by</th><th>For</th><th>Signature</th></tr>
        ${receipts}
      </table></div>
    </div>
  </div>
</div>
${siteFooter()}
`;
}

// ---------- 404 ----------
// Without this, Pages serves index.html with a 200 for every unmatched path.

function notFound() {
  return `${head('No such record — The Cybernetic Patch Dolls', 'No record exists at this address.')}
<style>
${BASE_CSS}
${FLOOR_CSS}
${SITE_CSS}
  .lost { padding: clamp(56px, 12vw, 128px) 0; border-bottom: 2px solid var(--ink); }
  .lost .code { font-family: var(--mono); font-size: var(--t-label); font-weight: 500; letter-spacing: 0.16em; color: var(--stamp-ink); margin-bottom: 18px; }
  .lost h1 { font-size: clamp(2rem, 5.5vw, 3.4rem); font-weight: 800; letter-spacing: -0.03em; line-height: 1.02; max-width: 18ch; }
  .lost p { margin-top: 22px; max-width: 54ch; font-size: var(--t-lead); color: var(--ink-2); }
  .lost .links { display: flex; flex-wrap: wrap; gap: 20px; margin-top: 28px; font-size: var(--t-label); font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; }
</style>
${masthead('Public registry', 'Not found')}
<div class="wrap">
  ${marks()}
  <div class="lost">
    <div class="code">404 · no such record</div>
    <h1>Nothing is filed at this address.</h1>
    <p>The registry holds ${dolls.length} ${dolls.length === 1 ? 'doll' : 'dolls'}. If you followed a
    certificate link, check the serial: every doll lives at <span class="mono">/d/&lt;name&gt;/</span>.</p>
    <div class="links">
      <a class="u" href="/">The register</a>
      <a class="u" href="/bee/">Coordination floor</a>
      <a class="u" href="${REPO}">Source</a>
    </div>
  </div>
</div>
`;
}

// ---------- emit ----------

rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });
writeFileSync(join(DIST, 'index.html'), landing());
writeFileSync(join(DIST, '404.html'), notFound());
mkdirSync(join(DIST, 'bee'), { recursive: true });
writeFileSync(join(DIST, 'bee', 'index.html'), floor());

// Work sold through the floor appends care entries without re-rendering the certificate,
// so reissue every one before publishing. Otherwise a certificate silently under-reports
// its own doll's history.
for (const { slug } of dolls) {
  execFileSync(process.execPath, [join(ROOT, 'bin', 'patchdoll.mjs'), 'reissue', slug], { cwd: ROOT, stdio: 'pipe' });
}

for (const { slug, dir } of dolls) {
  const out = join(DIST, 'd', slug);
  mkdirSync(out, { recursive: true });
  cpSync(join(dir, 'certificate.html'), join(out, 'index.html'));
}

// Public records stay fetchable so anyone can verify a doll independently.
for (const { slug, dir } of dolls) {
  const out = join(DIST, 'd', slug);
  cpSync(join(dir, 'genesis.json'), join(out, 'genesis.json'));
  cpSync(join(dir, 'care-record.json'), join(out, 'care-record.json'));
  cpSync(join(dir, 'keys', 'public.pem'), join(out, 'public.pem'));
}

writeFileSync(join(DIST, '_headers'), `/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  X-Frame-Options: DENY
`);
writeFileSync(join(DIST, 'robots.txt'), 'User-agent: *\nAllow: /\n');

console.log(`Built dist/ — ${dolls.length} certificates, landing page, floor snapshot.`);
