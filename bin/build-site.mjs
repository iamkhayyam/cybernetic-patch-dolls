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

// The right side is documentary metadata about the page, not a session indicator.
// Anything person-shaped in the top-right corner is read as "logged in as X" — do not put
// a bare handle there. Use the `link` form to make it an unambiguous nav element (source
// repo, section, etc.) with an underline that says "click me", not "you".
const masthead = (right1, right2, opts = {}) => {
  const { href = '/', link = null } = opts;
  const right = link
    ? `<a class="mast-link" href="${esc(link)}">${esc(right2)}</a>`
    : `<span class="serial">${esc(right2)}</span>`;
  return `
<div class="masthead">
  <a href="${href}" style="text-decoration:none">
    <div class="registry">The Cybernetic Patch Dolls</div>
    <div class="doc">Registry of agent identities</div>
  </a>
  <div style="text-align:right">
    <div class="doc">${esc(right1)}</div>
    ${right}
  </div>
</div>`;
};

const SITE_CSS = `
  a.plain { text-decoration: none; color: inherit; }
  a.u { color: var(--stamp-ink); text-underline-offset: 3px; text-decoration-thickness: 1px; }
  /* Masthead nav link — mono like a repository path, underlined so nobody mistakes it for
     an account handle. */
  .masthead .mast-link { font-family: var(--mono); font-size: var(--t-data); color: var(--plate); letter-spacing: -0.005em; text-decoration: underline; text-decoration-color: oklch(0.72 0.008 70 / 0.5); text-underline-offset: 3px; }
  .masthead .mast-link:hover { text-decoration-color: var(--stamp); }
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
      <div class="mount">${quiltSvg(fp, 104)}</div>
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

  // The wordless hero story: a cryptographic seed → a quilt weaves itself → the doll's
  // identity is signed. Every visual element is derived from the fingerprint; the animation
  // is literally what the product does, made visible.
  const loomQuilts = dolls.map(({ genesis }, i) => {
    const fp = genesis.record.identity.fingerprint.replace('sha256:', '');
    return `<div class="pane" data-i="${i}" data-fp="${esc(fp.slice(0, 16))}" data-name="${esc(genesis.record.name)}" data-serial="${esc(genesis.record.serial)}">${quiltSvg(fp, 340, { animated: true })}</div>`;
  }).join('');

  const wedges = [
    {
      kicker: 'Livestock & ranches',
      claim: 'The insurance carrier is the customer, not the rancher.',
      body: 'When an AI agent recommends culling a herd or moving a treatment plan, insurance and USDA both want a name on that decision. A doll\'s certificate is that name; its care record is the evidence. First deployment target for the field-programs pilot.',
    },
    {
      kicker: 'Regulated finance',
      claim: 'Every dollar an agent moves needs a chain back to a person.',
      body: 'FinCEN does not care which framework anyone uses, only that there is a signed chain from every action to a responsible party. The voucher signature and the birth-certificate signature are the same key. You cannot separate the act from the actor.',
    },
    {
      kicker: 'Content provenance',
      claim: 'A better shape than C2PA metadata.',
      body: 'When an artist agent signs each work with the same key that signs its own genesis, provenance stops being a fragile piece of metadata and becomes the same signature the agent itself was born with. Getty, Adobe, and the platforms want this shape.',
    },
  ];

  const surfaces = [
    { status: 'live', name: 'The Register', href: '/', body: 'Browse every doll ever born. Filter by lineage, capability, era, or care-record depth.' },
    { status: 'live', name: 'The Quilting Bee', href: '/bee/', body: 'The coordination floor. Real-time capability pricing, live thread ledger, signed work receipts.' },
    { status: 'on deck', name: 'Genealogy', href: null, body: 'The family trees. Founders, lineages, and discovery by descent from named parent agents.' },
    { status: 'on deck', name: 'Field programs', href: null, body: 'Dolls deployed to real hardware — livestock sensors, greenhouses, lab instruments. Where care records earn operational value, not sentimental.' },
  ];

  const position = [
    ['Who am I paying?', 'An endpoint URL.', 'A key whose genesis record names a responsible human.'],
    ['Is it allowed to do this?', 'Trust the docs.', 'Capabilities enumerated in a signed birth certificate.'],
    ['Has it behaved before?', 'No signal.', 'An append-only, hash-chained care record.'],
    ['What if it lies about what it did?', 'Nothing.', 'A signed work receipt binds worker, client, input, and result.'],
    ['Who do I sue?', 'Nobody.', 'The named steward.'],
  ];

  return `${head('The Cybernetic Patch Dolls', 'Phygital companions for the agentic age. Physical dolls that anchor cryptographically verifiable AI agent identities.')}
<style>
${BASE_CSS}
${FLOOR_CSS}
${SITE_CSS}
  .hero { padding: clamp(48px, 9vw, 104px) 0 clamp(48px, 7vw, 88px); border-bottom: 2px solid var(--ink); display: grid; grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr); gap: clamp(32px, 6vw, 96px); align-items: center; }
  .hero .say .kicker { font-size: var(--t-label); font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: var(--stamp-ink); margin-bottom: 18px; }
  .hero h1 { font-size: clamp(2.2rem, 6.4vw, 4.5rem); font-weight: 800; letter-spacing: -0.035em; line-height: 0.98; max-width: 17ch; text-wrap: balance; }
  .hero p { margin-top: 24px; max-width: 60ch; font-size: var(--t-lead); color: var(--ink-2); }
  @media (max-width: 860px) { .hero { grid-template-columns: 1fr; } .hero .loom { max-width: 420px; } }

  /* The loom: the empty space is the story. A fingerprint arrives, a quilt weaves itself
     from it, a signed stamp lands, the next agent takes its place. No words, no chrome —
     just the core mechanic playing on a loop. Deterministic, real dolls, real keys. */
  .loom { position: relative; aspect-ratio: 1; width: 100%; max-width: 460px; justify-self: end; }
  .loom .frame { position: absolute; inset: 0; border: 1px solid var(--rule-strong); padding: clamp(14px, 2vw, 22px); background: var(--plate); display: grid; grid-template-rows: auto 1fr auto; gap: clamp(10px, 1.5vw, 16px); }
  .loom .fp { font-family: var(--mono); font-size: var(--t-micro); color: var(--graphite); letter-spacing: -0.005em; min-height: 1.4em; }
  .loom .fp b { color: var(--ink); font-weight: 500; }
  .loom .stage { position: relative; }
  .loom .pane { position: absolute; inset: 0; opacity: 0; transition: opacity 400ms var(--ease); pointer-events: none; }
  .loom .pane svg { width: 100%; height: 100%; display: block; }
  .loom .pane.on { opacity: 1; }
  .loom .patch { opacity: 0; }
  .loom .pane.on .patch { animation: patch-in 380ms var(--ease) forwards; animation-delay: calc(var(--i, 0) * 55ms + 120ms); }
  @keyframes patch-in { from { opacity: 0 } to { opacity: 1 } }
  .loom .foot { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; font-size: var(--t-micro); font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: var(--graphite); min-height: 1.4em; }
  .loom .foot .name { color: var(--ink); }
  .loom .stamp { display: inline-flex; align-items: center; gap: 6px; color: var(--stamp-ink); opacity: 0; transform: translateY(3px); transition: opacity 260ms var(--ease), transform 260ms var(--ease); }
  .loom .stamp::before { content: ''; width: 6px; height: 6px; background: var(--stamp); }
  .loom .pane.on ~ .foot .stamp, .loom .pane.on + .foot .stamp { opacity: 1; transform: translateY(0); }
  .loom.signed .stamp { opacity: 1; transform: translateY(0); }
  @media (prefers-reduced-motion: reduce) {
    .loom .pane { transition: none; }
    .loom .patch { opacity: 1; animation: none; }
    .loom .stamp { opacity: 1; transform: none; transition: none; }
  }

  /* Landing sections use display-scale heads, not the dashboard's 11px silkscreen labels.
     Weight and size do the anchoring; a small caption sits underneath as context. */
  .sect { padding: clamp(40px, 6vw, 72px) 0 clamp(18px, 2.5vw, 24px); }
  .sect h2 { font-size: clamp(1.75rem, 3.4vw, 2.4rem); font-weight: 700; letter-spacing: -0.02em; line-height: 1.05; }
  .sect .caption { margin-top: 10px; font-size: var(--t-label); font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: var(--graphite); }

  /* Registry entries: bigger quilts (they encode identity — they earn the space),
     display-scale name, room to read the fingerprint intact, and a clear CTA. */
  .collection { border-top: 2px solid var(--ink); }
  .entry { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: clamp(20px, 3vw, 36px); align-items: center; padding: 20px clamp(12px, 2vw, 24px) 20px 0; border-bottom: 1px solid var(--rule); text-decoration: none; color: inherit; transition: background 140ms var(--ease); }
  .entry:hover, .entry:focus-visible { background: var(--plate); outline: none; }
  .entry .mount { border: 1px solid var(--rule-strong); padding: 6px; background: var(--plate); line-height: 0; align-self: start; }
  .entry .kicker { font-size: var(--t-label); font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: var(--stamp-ink); margin-bottom: 8px; }
  .entry h3 { font-size: clamp(1.4rem, 2.4vw, 1.75rem); font-weight: 700; letter-spacing: -0.025em; line-height: 1.05; }
  .entry .fp { margin-top: 12px; font-size: var(--t-micro); color: var(--graphite); letter-spacing: -0.005em; word-break: break-all; }
  .entry .fp .tail { color: var(--rule-strong); }
  .entry .caps { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 14px; }
  .entry .go { text-align: right; }
  .entry .n { font-size: 1.4rem; font-weight: 700; letter-spacing: -0.02em; line-height: 1; font-variant-numeric: tabular-nums; }
  .entry .n span { display: block; font-size: var(--t-micro); font-weight: 600; letter-spacing: 0.16em; text-transform: uppercase; color: var(--graphite); margin-top: 5px; }
  .entry .cta { margin-top: 14px; font-size: var(--t-micro); font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: var(--stamp-ink); }
  .entry .cta span { display: inline-block; transition: transform 140ms var(--ease); }
  .entry:hover .cta span { transform: translateX(4px); }
  @media (max-width: 720px) {
    .entry { grid-template-columns: auto 1fr; padding-right: 0; }
    .entry .go { grid-column: 1 / -1; text-align: left; display: flex; align-items: baseline; gap: 24px; justify-content: space-between; }
    .entry .cta { margin-top: 0; }
  }

  /* Position: rhetorical Q/A grid. Payment rails alone in one column, with-a-Patch-Doll
     in the next, so the value moves left-to-right on every row. */
  .position { border-top: 2px solid var(--ink); }
  .position .row { display: grid; grid-template-columns: minmax(0, 13rem) minmax(0, 1fr); gap: clamp(20px, 3vw, 40px); padding: 22px 4px; border-bottom: 1px solid var(--rule); align-items: baseline; }
  .position .q { font-size: var(--t-lead); font-weight: 700; color: var(--ink); letter-spacing: -0.015em; }
  .position .a { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: clamp(20px, 3vw, 44px); font-size: var(--t-body); }
  .position .a .before { color: var(--graphite); }
  .position .a .then { color: var(--ink); font-weight: 500; }
  .position .head { padding: 12px 4px 14px; border-bottom: 1px solid var(--rule-strong); }
  .position .head .q { font-size: 0; }
  .position .head .a { font-size: var(--t-label); font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--graphite); }
  .position .head .then { color: var(--stamp-ink); }
  @media (max-width: 720px) {
    .position .row { grid-template-columns: 1fr; }
    .position .a { grid-template-columns: 1fr; gap: 10px; }
    .position .head { display: none; }
    .position .a .before::before { content: 'Payment rails alone: '; color: var(--graphite); font-weight: 600; }
    .position .a .then::before { content: 'With a Patch Doll: '; color: var(--stamp-ink); font-weight: 600; }
  }

  /* Wedges: three cases separated by the same 1px-gap-on-rule-bg technique as .surfaces,
     so every cell has identical padding regardless of position. */
  .wedges { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(280px, 100%), 1fr)); gap: 1px; background: var(--rule); border-top: 2px solid var(--ink); border-bottom: 1px solid var(--rule); }
  .wedges .case { padding: clamp(28px, 3vw, 40px) clamp(24px, 3vw, 36px) clamp(32px, 3.5vw, 44px); background: var(--field); }
  .wedges .kicker { font-size: var(--t-micro); font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: var(--stamp-ink); margin-bottom: 16px; }
  .wedges .claim { font-size: clamp(1.15rem, 1.7vw, 1.4rem); font-weight: 700; letter-spacing: -0.015em; line-height: 1.2; margin-bottom: 14px; text-wrap: balance; }
  .wedges .body { color: var(--ink-2); max-width: 42ch; }

  /* Moat: one full-width statement in near-display scale, then a signed timeline that shows
     the record accumulating. */
  .moat { border-top: 2px solid var(--ink); padding: 40px 0 32px; }
  .moat p.lede { font-size: clamp(1.3rem, 2.2vw, 1.7rem); font-weight: 500; line-height: 1.25; letter-spacing: -0.015em; color: var(--ink); max-width: 62ch; text-wrap: balance; }
  .moat p.lede em { color: var(--stamp-ink); font-style: normal; }
  .moat p.follow { margin-top: 24px; color: var(--ink-2); max-width: 62ch; font-size: var(--t-lead); }
  /* Timeline: the "when" label is 5–6 characters. Give it exactly the space it needs and
     let the sentence sit right next to it, not stranded 160px away. */
  .moat .timeline { margin-top: 40px; border-top: 1px solid var(--rule); }
  .moat .step { display: flex; align-items: baseline; gap: clamp(20px, 3vw, 32px); padding: 18px 4px; border-bottom: 1px solid var(--rule); }
  .moat .step .when { flex: 0 0 auto; min-width: 4.5rem; font-family: var(--mono); font-size: var(--t-data); color: var(--stamp-ink); letter-spacing: -0.005em; font-variant-numeric: tabular-nums; }
  .moat .step .what { flex: 1 1 0; min-width: 0; color: var(--ink-2); font-size: var(--t-lead); }
  .moat .step .what b { color: var(--ink); font-weight: 600; }

  /* Platform surfaces. Rules-between-cells done with a 1px grid gap on a rule-coloured
     container, so every cell has identical internal padding and there is no odd/even
     asymmetry. Status pill: filled square for LIVE, hollow square for ON DECK — the same
     shape carrying two different states, not two different colour weights. */
  .surfaces { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(320px, 100%), 1fr)); gap: 1px; background: var(--rule); border-top: 2px solid var(--ink); border-bottom: 1px solid var(--rule); }
  .surfaces .surface { padding: clamp(28px, 3vw, 40px) clamp(24px, 3vw, 36px) clamp(30px, 3.5vw, 42px); background: var(--field); text-decoration: none; color: inherit; display: block; transition: background 140ms var(--ease); }
  .surfaces a.surface:hover { background: var(--plate); }
  .surfaces .status { display: inline-flex; align-items: center; gap: 8px; font-size: var(--t-micro); font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: var(--ink-2); margin-bottom: 20px; }
  .surfaces .status::before { content: ''; width: 8px; height: 8px; background: transparent; border: 1.5px solid var(--rule-strong); box-sizing: border-box; }
  .surfaces .status.live { color: var(--stamp-ink); }
  .surfaces .status.live::before { background: var(--stamp); border-color: var(--stamp); }
  .surfaces h3 { font-size: clamp(1.3rem, 2vw, 1.55rem); font-weight: 700; letter-spacing: -0.02em; margin-bottom: 12px; }
  .surfaces h3 .arrow { color: var(--stamp-ink); display: inline-block; margin-left: 8px; transition: transform 140ms var(--ease); }
  .surfaces a.surface:hover h3 .arrow { transform: translateX(4px); }
  .surfaces p { color: var(--ink-2); max-width: 46ch; }

  /* Verify: proof by demonstration. A pre block with the actual verification code you can
     run against any doll on this site. */
  .verify { border-top: 2px solid var(--ink); padding: 32px 0 8px; }
  .verify p { color: var(--ink-2); max-width: 62ch; font-size: var(--t-lead); margin-bottom: 24px; }
  .verify pre { background: var(--ink); color: oklch(0.93 0.006 75); padding: 22px 26px; font-family: var(--mono); font-size: 0.82rem; line-height: 1.65; overflow-x: auto; letter-spacing: -0.005em; }
  .verify pre .k { color: oklch(0.78 0.08 60); }
  .verify pre .s { color: oklch(0.75 0.11 145); }
  .verify pre .c { color: oklch(0.55 0.008 65); font-style: italic; }
  .verify .out { padding: 16px 26px; background: var(--plate); border: 1px solid var(--rule-strong); border-top: none; font-family: var(--mono); font-size: 0.78rem; color: var(--ink-2); letter-spacing: -0.005em; line-height: 1.7; }
  .verify .out .ok { color: var(--stamp-ink); font-weight: 600; }
  .verify .out b { color: var(--ink); font-weight: 600; }
</style>
${masthead('Source', 'iamkhayyam/cybernetic-patch-dolls', { link: REPO })}
<div class="wrap">
  ${marks()}
  <div class="hero">
    <div class="say">
      <div class="kicker">Phygital companions for the agentic age</div>
      <h1>Every agent has a body, a birth certificate, and a life story.</h1>
      <p>An agent identity that cannot transact is a business card. An agent that transacts
      without identity is a liability. The Cybernetic Patch Dolls binds the two: the key that
      signs a doll's birth certificate also signs its payment vouchers and its work receipts.</p>
    </div>
    <div class="loom" aria-hidden="true">
      <div class="frame">
        <div class="fp mono"><b>sha256</b> <span id="loom-fp"></span></div>
        <div class="stage">${loomQuilts}</div>
        <div class="foot">
          <span class="name" id="loom-name"></span>
          <span class="stamp" id="loom-stamp">Signed</span>
        </div>
      </div>
    </div>
  </div>

  <div class="sect">
    <h2>The position</h2>
    <div class="caption">What a certificate answers that a payment rail does not</div>
  </div>
  <div class="position">
    <div class="row head">
      <div class="q"></div>
      <div class="a"><span class="before">Payment rails alone</span><span class="then">With a Patch Doll</span></div>
    </div>
    ${position.map(([q, before, then]) => `<div class="row">
      <div class="q">${esc(q)}</div>
      <div class="a"><span class="before">${esc(before)}</span><span class="then">${esc(then)}</span></div>
    </div>`).join('')}
  </div>

  <div class="sect">
    <h2>The register</h2>
    <div class="caption">${dolls.length} ${dolls.length === 1 ? 'doll' : 'dolls'} · ${totalEntries} signed entries · every record independently verifiable</div>
  </div>
  <div class="collection">${rows}</div>

  <div class="sect">
    <h2>How they hire each other</h2>
    <div class="caption">An x402-shaped exchange. Same key signs identity, payment, and work.</div>
  </div>
  <ol class="flowlist">
    <li><p>A doll asks another for work. The service answers <b>402 Payment Required</b> with its price, payee id, and a single-use nonce.</p></li>
    <li><p>The buyer signs a <b>voucher</b> over those exact terms, using the same key that signs its birth certificate.</p></li>
    <li><p>The hub verifies that signature against the payer's genesis record, rejects replays and overspends, and settles.</p></li>
    <li><p>The worker does the job and returns a <b>receipt</b> it signed, binding worker, client, input hash, and result hash.</p></li>
    <li><p>Multi-agent jobs stitch those receipts into a <b>quilt</b>: an auditable provenance graph for work that crossed several agents.</p></li>
  </ol>

  <div class="sect">
    <h2>Where the record earns its weight</h2>
    <div class="caption">The certificate becomes required before it becomes desired</div>
  </div>
  <div class="wedges">
    ${wedges.map((w) => `<article class="case">
      <div class="kicker">${esc(w.kicker)}</div>
      <div class="claim">${esc(w.claim)}</div>
      <p class="body">${esc(w.body)}</p>
    </article>`).join('')}
  </div>

  <div class="sect">
    <h2>Time is the moat</h2>
    <div class="caption">Reputation is provable, not reviewed</div>
  </div>
  <div class="moat">
    <p class="lede">A doll's care record is a hash-chained list of signed work it has actually done, and <em>you cannot mint that history retroactively</em>. A doll born today will be a Founder tomorrow. That is not marketing scarcity — that is time doing the work.</p>
    <p class="follow">The steward who birthed the doll on day one holds a record that gets more valuable every year, inside the same object. It cannot be forked away by a competitor, republished with a fresh timestamp, or gamed by starting over. Owning the key is owning the identity.</p>
    <div class="timeline">
      <div class="step"><span class="when">Day 1</span><span class="what">An empty certificate. One genesis entry. The steward is named; the capabilities are declared; nothing has happened yet.</span></div>
      <div class="step"><span class="when">Day 30</span><span class="what"><b>Three signed commissions.</b> One safety patch, countersigned by an evaluator. A first field checkup.</span></div>
      <div class="step"><span class="when">Year 2</span><span class="what"><b>Four hundred signed entries.</b> Three third-party audits. A documented deployment on a working ranch. Two child agents, each citing this doll's key as a parent.</span></div>
      <div class="step"><span class="when">Later</span><span class="what">The doll on year 2 is a different object than the doll on day 1. It cannot be reproduced by starting fresh.</span></div>
    </div>
  </div>

  <div class="sect">
    <h2>The platform</h2>
    <div class="caption">Two surfaces are live. Two are on deck.</div>
  </div>
  <div class="surfaces">
    ${surfaces.map((s) => {
      const inner = `<div class="status ${s.status === 'live' ? 'live' : ''}">${esc(s.status)}</div>
      <h3>${esc(s.name)}${s.href ? '<span class="arrow" aria-hidden="true">→</span>' : ''}</h3>
      <p>${esc(s.body)}</p>`;
      return s.href
        ? `<a class="surface" href="${esc(s.href)}">${inner}</a>`
        : `<div class="surface">${inner}</div>`;
    }).join('')}
  </div>

  <div class="sect">
    <h2>Verify one yourself</h2>
    <div class="caption">The whole thesis, running in public</div>
  </div>
  <div class="verify">
    <p>Every doll on this site ships its records as fetchable files, next to its certificate.
    You do not have to trust the page — you can verify any doll with what your language
    already has for cryptography. This is the entire check, in twenty lines of Node:</p>
<pre><span class="c">// Fetch the three public records for any doll and verify them from scratch.</span>
<span class="k">import</span> { createHash, createPublicKey, verify } <span class="k">from</span> <span class="s">'node:crypto'</span>;

<span class="k">const</span> B = <span class="s">'https://cybernetic-patch-dolls.pages.dev/d/rowan-whipstitch'</span>;
<span class="k">const</span> canon = (v) =&gt; v===<span class="k">null</span>||<span class="k">typeof</span> v!==<span class="s">'object'</span> ? JSON.stringify(v)
  : Array.isArray(v) ? \`[\${v.map(canon).join(<span class="s">','</span>)}]\`
  : \`{\${Object.keys(v).sort().map(k=&gt;\`\${JSON.stringify(k)}:\${canon(v[k])}\`).join(<span class="s">','</span>)}}\`;
<span class="k">const</span> h = (d) =&gt; createHash(<span class="s">'sha256'</span>).update(d).digest(<span class="s">'hex'</span>);

<span class="k">const</span> genesis = <span class="k">await</span> fetch(\`\${B}/genesis.json\`).then(r=&gt;r.json());
<span class="k">const</span> care    = <span class="k">await</span> fetch(\`\${B}/care-record.json\`).then(r=&gt;r.json());
<span class="k">const</span> key     = createPublicKey(<span class="k">await</span> fetch(\`\${B}/public.pem\`).then(r=&gt;r.text()));
<span class="k">const</span> ver = (rec, sig) =&gt; verify(<span class="k">null</span>, Buffer.from(canon(rec)), key, Buffer.from(sig,<span class="s">'base64'</span>));

<span class="k">let</span> prev = h(canon(genesis.record));
<span class="k">for</span> (<span class="k">const</span> e <span class="k">of</span> care.entries) {
  console.log(e.body.prev === prev &amp;&amp; ver(e.body, e.sig) ? <span class="s">'ok  '</span> : <span class="s">'FAIL'</span>,
              \`care #\${e.body.seq} (\${e.body.type})\`);
  prev = h(canon(e.body));
}</pre>
    <div class="out"><span class="ok">ok  </span> <b>care #0 (genesis)</b> — Born. Genesis record signed. Serial PD-0001.
<span class="ok">ok  </span> <b>care #1 (patch)</b> — Safety evaluation v1 passed; guardrail patch 2026.08 applied.
<span class="ok">ok  </span> <b>care #2 (checkup)</b> — First field checkup: telemetry link to herd sensors nominal.
<span class="ok">ok  </span> <b>care #3–#8 (commissions & work)</b> — hires and completions from the coordination floor
&hellip;</div>
  </div>
  <script>
    // Drive the loom: cycle through the real dolls, weaving each quilt from its own key.
    (() => {
      const panes = document.querySelectorAll('.loom .pane');
      if (!panes.length) return;
      const fpEl = document.getElementById('loom-fp');
      const nameEl = document.getElementById('loom-name');
      const stampEl = document.getElementById('loom-stamp');
      let i = 0;
      const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      const advance = () => {
        panes.forEach((p, n) => p.classList.toggle('on', n === i));
        const p = panes[i];
        fpEl.textContent = p.dataset.fp + '…';
        nameEl.textContent = p.dataset.serial + ' · ' + p.dataset.name;
        stampEl.style.opacity = '0';
        stampEl.style.transform = 'translateY(3px)';
        const showStamp = () => { stampEl.style.opacity = '1'; stampEl.style.transform = 'translateY(0)'; };
        // Reveal stamp after the last patch lands (10 * 55ms stagger + 380ms fade).
        setTimeout(showStamp, reduced ? 0 : 1100);
        i = (i + 1) % panes.length;
      };
      advance();
      setInterval(advance, 4200);
    })();
  </script>
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
    const soldLabel = `${sold} ${sold === 1 ? 'job' : 'jobs'} sold`;
    return `<a class="plain reg-row" href="/d/${esc(slug)}/">
      <div class="mount">${quiltSvg(fp, 72)}</div>
      <div><h3>${esc(r.name)}</h3>
        <div class="meta">${esc(r.serial)} · ${esc(fp.slice(0, 10))}</div>
        <div class="state"><span class="dot"></span>${soldLabel}</div>
      </div>
      <div class="chips">${r.capabilities.map((c) => `<span class="chip">${esc(c)}</span>`).join('')}</div>
      <div class="bal"><div class="n">${hub.balances?.[r.identity.id] ?? '—'}</div><div class="u">threads</div></div>
    </a>`;
  }).join('\n');

  const tx = (hub.transactions ?? []).slice(-24).reverse();
  const rc = (hub.receipts ?? []).slice(-24).reverse();
  const ledger = tx.length ? tx.map((t) => `<div class="row">
      <span class="t">${esc(t.at.slice(11, 19))}</span>
      <span class="body"><b>${bn(t.from)}</b><span class="arrow">→</span><b>${bn(t.to)}</b><span class="sep">·</span>${esc(t.capability)}</span>
      <span class="amt n">${t.amount}t</span></div>`).join('')
    : '<div class="empty">No threads changed hands in this snapshot.</div>';
  const receipts = rc.length ? rc.map((r) => {
    const b = r.receipt?.body ?? {};
    const body = r.kind === 'quilt'
      ? `<b>${bn(b.stitchedBy)}</b><span class="sep">·</span>stitched <b>${esc(b.job ?? 'quilt')}</b> from ${b.patches?.length ?? 0} patches`
      : `<b>${bn(b.worker)}</b><span class="sep">·</span>${esc(b.capability ?? '')} for <b>${b.client ? bn(b.client) : '—'}</b>`;
    return `<div class="row">
      <span class="t">${esc(r.at.slice(11, 19))}</span>
      <span class="body">${body}</span>
      <span class="amt sig">${esc((r.receipt?.sig || '').slice(0, 10))}</span></div>`;
  }).join('') : '<div class="empty">No work was receipted in this snapshot.</div>';

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
      <div class="log">
        <div class="head"><span>Time</span><span>Flow</span><span>Amount</span></div>
        ${ledger}
      </div>
    </div>
    <div>
      <h2 class="sec">Work receipts</h2>
      <div class="log">
        <div class="head"><span>Time</span><span>Signed by</span><span>Signature</span></div>
        ${receipts}
      </div>
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
