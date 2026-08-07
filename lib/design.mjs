// The Cybernetic Patch Dolls — shared design system.
// See DESIGN.md. The certificate is the source surface; the dashboard inherits from it.

export const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800&family=Spline+Sans+Mono:wght@400;500;600&display=swap" rel="stylesheet">`;

// Nothing in the layout depends on exact metrics, so an offline document degrades
// gracefully to a system grotesque.
const SANS = `'Archivo', ui-sans-serif, system-ui, -apple-system, 'Helvetica Neue', Arial, sans-serif`;
const MONO = `'Spline Sans Mono', ui-monospace, 'SF Mono', Menlo, Consolas, monospace`;

export const TOKENS = `
  --ink: oklch(0.19 0.012 62);
  --ink-2: oklch(0.33 0.010 62);
  --graphite: oklch(0.52 0.008 65);
  --field: oklch(0.955 0.004 75);
  --plate: oklch(0.988 0.003 75);
  --rule: oklch(0.875 0.005 70);
  --rule-strong: oklch(0.76 0.006 70);
  /* --stamp is for fills, rules and indicators, where contrast ratios don't apply.
     --stamp-ink is the same hue darkened for type, so small accent text clears 7:1. */
  --stamp: oklch(0.575 0.20 32);
  --stamp-ink: oklch(0.455 0.155 32);
  --stamp-wash: oklch(0.575 0.20 32 / 0.10);

  --sans: ${SANS};
  --mono: ${MONO};

  --t-display: clamp(2.4rem, 6vw, 4rem);
  --t-title: clamp(1.4rem, 2.6vw, 1.9rem);
  --t-lead: 1.0625rem;
  --t-body: 0.9375rem;
  --t-data: 0.875rem;
  --t-label: 0.6875rem;
  --t-micro: 0.625rem;

  --ease: cubic-bezier(0.22, 1, 0.36, 1);
`;

export const BASE_CSS = `
  :root { color-scheme: light; ${TOKENS} }
  *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
  html { -webkit-text-size-adjust: 100%; }
  body {
    background: var(--field);
    color: var(--ink);
    font-family: var(--sans);
    font-size: var(--t-body);
    line-height: 1.55;
    font-feature-settings: 'tnum' 1, 'cv05' 1;
    -webkit-font-smoothing: antialiased;
  }

  /* ---- silkscreen label layer ---- */
  .label, .micro {
    font-size: var(--t-label);
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--graphite);
    line-height: 1.3;
  }
  .micro { font-size: var(--t-micro); letter-spacing: 0.16em; }
  .mono { font-family: var(--mono); font-variant-ligatures: none; }

  /* ---- masthead: the continuity device between surfaces ---- */
  .masthead {
    background: var(--ink);
    color: var(--plate);
    border-bottom: 2px solid var(--stamp);
    padding: 18px clamp(16px, 4vw, 40px) 16px;
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 16px 32px;
    flex-wrap: wrap;
  }
  .masthead .registry {
    font-size: var(--t-label);
    font-weight: 700;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--plate);
  }
  .masthead .doc {
    font-size: var(--t-micro);
    font-weight: 600;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: oklch(0.72 0.008 70);
  }
  .masthead .serial {
    font-family: var(--mono);
    font-size: var(--t-data);
    font-weight: 500;
    color: var(--plate);
    letter-spacing: 0.04em;
  }

  /* ---- registration marks (print production language) ---- */
  .marks { position: absolute; inset: 0; pointer-events: none; }
  .marks span { position: absolute; width: 13px; height: 13px; }
  .marks span:nth-child(1) { top: 0; left: 0; border-top: 1px solid var(--rule-strong); border-left: 1px solid var(--rule-strong); }
  .marks span:nth-child(2) { top: 0; right: 0; border-top: 1px solid var(--rule-strong); border-right: 1px solid var(--rule-strong); }
  .marks span:nth-child(3) { bottom: 0; left: 0; border-bottom: 1px solid var(--rule-strong); border-left: 1px solid var(--rule-strong); }
  .marks span:nth-child(4) { bottom: 0; right: 0; border-bottom: 1px solid var(--rule-strong); border-right: 1px solid var(--rule-strong); }

  /* ---- specimen plate: identicon + its fingerprint ---- */
  .specimen { display: flex; flex-direction: column; gap: 10px; }
  .specimen .mount { border: 1px solid var(--rule-strong); padding: 7px; background: var(--plate); align-self: start; }
  .specimen svg { display: block; }
  .specimen .fp { font-family: var(--mono); font-size: var(--t-micro); line-height: 1.6; color: var(--graphite); word-break: break-all; letter-spacing: 0.01em; }

  /* ---- label / value grid ---- */
  /* Label above value, each on its own full-width line. A two-column split squeezes long
     mono values into a narrow track and breaks ids and keys mid-token. */
  .lv { border-top: 1px solid var(--rule); }
  .lv .row { padding: 10px 0 11px; border-bottom: 1px solid var(--rule); }
  .lv .row > dt { margin-bottom: 5px; }
  .lv .row > dd { color: var(--ink-2); overflow-wrap: anywhere; }
  .lv .row > dd.mono { font-size: var(--t-data); color: var(--ink); letter-spacing: -0.01em; }
  .lv em { color: var(--graphite); font-style: normal; }

  /* ---- capability chip ---- */
  .chip {
    display: inline-flex; align-items: baseline; gap: 7px;
    border: 1px solid var(--rule-strong);
    padding: 2px 8px;
    font-size: var(--t-micro);
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-2);
    white-space: nowrap;
  }
  .chip b { font-family: var(--mono); font-weight: 500; letter-spacing: 0; color: var(--graphite); text-transform: none; }

  /* ---- data table ---- */
  table.data { width: 100%; border-collapse: collapse; background: var(--plate); }
  table.data th {
    text-align: left; font-size: var(--t-label); font-weight: 600;
    letter-spacing: 0.14em; text-transform: uppercase; color: var(--graphite);
    padding: 8px 14px 8px 0; border-bottom: 1px solid var(--rule-strong); white-space: nowrap;
  }
  /* One type size across every cell. Hierarchy comes from weight and colour, never from
     mixing sizes column to column, which is what makes a row read as ragged. */
  table.data td {
    padding: 12px 14px 12px 0; border-bottom: 1px solid var(--rule);
    font-size: var(--t-data); color: var(--ink-2); vertical-align: baseline;
  }
  table.data td:last-child, table.data th:last-child { padding-right: 0; }

  /* Compact: columns size to their content and are separated by an even gutter.
     A full-width table with four short columns dumps all its slack into one gap and
     flings the end columns to opposite edges. Only use the 100% default when a column
     holds real prose that should absorb the remaining width. */
  table.data.compact { width: auto; min-width: 0; }
  table.data.compact th, table.data.compact td { padding-right: clamp(20px, 2.2vw, 34px); }
  table.data.compact th:last-child, table.data.compact td:last-child { padding-right: 0; }

  /* Log: each row is a single line of text — time, the sentence of what happened, and a
     right-anchored value. Not a four-column table, because four-column tables always
     produce visible gaps between short cells. The middle span absorbs slack so numbers
     and signatures land right next to what they describe. */
  .log { border-top: 1px solid var(--rule); }
  .log .head, .log .row { display: grid; grid-template-columns: 5rem minmax(0, 1fr) 7rem; align-items: baseline; gap: clamp(14px, 2vw, 22px); padding: 11px 2px; border-bottom: 1px solid var(--rule); font-size: var(--t-data); }
  .log .head { padding: 7px 2px 9px; }
  .log .head span { font-size: var(--t-label); font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: var(--graphite); }
  .log .head span:last-child { text-align: right; }
  .log .row .t { font-family: var(--mono); color: var(--graphite); font-size: var(--t-micro); letter-spacing: 0.01em; }
  .log .row .body { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--ink-2); }
  .log .row .body b { color: var(--ink); font-weight: 600; }
  .log .row .body .arrow { color: var(--graphite); margin: 0 6px; font-weight: 400; }
  .log .row .body .sep { color: var(--rule-strong); margin: 0 8px; }
  .log .row .amt { text-align: right; font-family: var(--mono); font-variant-numeric: tabular-nums; }
  .log .row .amt.n { color: var(--ink); font-weight: 600; }
  .log .row .amt.sig { color: var(--graphite); font-size: var(--t-micro); letter-spacing: 0.01em; }
  .log .empty { padding: 20px 2px; color: var(--graphite); font-style: italic; border-bottom: 1px solid var(--rule); }
  .log .row.fresh { animation: stamp 1.6s var(--ease) 1; }

  table.data td.num, table.data th.num { font-variant-numeric: tabular-nums; text-align: right; }
  table.data td.num { color: var(--ink); font-weight: 600; }
  table.data td.mono, table.data td .mono { font-family: var(--mono); font-size: var(--t-data); color: var(--graphite); letter-spacing: -0.01em; }
  table.data td.nowrap { white-space: nowrap; }
  table.data .none { color: var(--graphite); padding: 18px 0; }

  /* Wide content scrolls inside its own container; the page itself never scrolls sideways. */
  .scroll-x { overflow-x: auto; }

  ::selection { background: var(--stamp); color: var(--plate); }
  a { color: inherit; }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation: none !important; transition: none !important; }
  }
`;

// Floor styles — shared by the live hub dashboard and the static registry site.
export const FLOOR_CSS = `
  .wrap { max-width: 1180px; margin: 0 auto; padding: 0 clamp(16px, 4vw, 40px); position: relative; }

  /* ---- status strip: one ruled instrument bar, deliberately not four stat boxes ---- */
  .strip { display: flex; flex-wrap: wrap; align-items: stretch; padding: 0 clamp(12px, 2vw, 24px); border-bottom: 1px solid var(--rule); background: var(--plate); }
  .strip .cell { padding: 16px clamp(18px, 3vw, 34px) 16px 0; margin-right: clamp(18px, 3vw, 34px); border-right: 1px solid var(--rule); display: flex; align-items: baseline; gap: 10px; }
  .strip .cell:last-child { border-right: none; margin-right: 0; padding-right: 0; }
  .strip .v { font-size: 1.5rem; font-weight: 700; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
  .strip .k { font-size: var(--t-micro); font-weight: 600; letter-spacing: 0.16em; text-transform: uppercase; color: var(--graphite); }
  .strip .live { margin-left: auto; align-self: center; padding: 16px 0; display: flex; align-items: center; gap: 8px; border-right: none; }
  .pulse { width: 7px; height: 7px; background: var(--stamp); flex-shrink: 0; }
  @media (prefers-reduced-motion: no-preference) { .pulse { animation: pulse 2.4s var(--ease) infinite; } }
  @keyframes pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.25 } }

  h2.sec { font-size: var(--t-label); font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink); padding: 40px 0 10px; }
  h2.sec span { color: var(--graphite); font-weight: 600; }
  h2.sec span::before { content: '·'; margin: 0 8px; }

  /* ---- register rows: full-width ruled listings, never a card grid ---- */
  .register { border-top: 1px solid var(--rule-strong); }
  .reg-row { display: grid; grid-template-columns: auto minmax(12rem, 17rem) 1fr auto; gap: 14px clamp(16px, 3vw, 32px); align-items: center; padding: 16px clamp(12px, 2vw, 24px) 16px 0; border-bottom: 1px solid var(--rule); }
  .reg-row .mount { border: 1px solid var(--rule-strong); padding: 5px; background: var(--plate); line-height: 0; }
  .reg-row h3 { font-size: var(--t-title); font-weight: 700; letter-spacing: -0.02em; line-height: 1.1; }
  .reg-row .meta { font-family: var(--mono); font-size: var(--t-micro); color: var(--graphite); margin-top: 5px; letter-spacing: 0.02em; }
  .reg-row .state { display: flex; align-items: center; gap: 7px; margin-top: 7px; font-size: var(--t-micro); font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; }
  .reg-row .state .dot { width: 7px; height: 7px; background: var(--rule-strong); flex-shrink: 0; }
  .reg-row.on .state { color: var(--stamp-ink); }
  .reg-row.on .state .dot { background: var(--stamp); }
  .reg-row .chips { display: flex; flex-wrap: wrap; gap: 5px; }
  .reg-row .idle { font-size: var(--t-body); color: var(--graphite); }
  .reg-row .bal { text-align: right; white-space: nowrap; }
  .reg-row .bal .n { font-size: 1.6rem; font-weight: 700; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; line-height: 1; }
  .reg-row .bal .u { font-size: var(--t-micro); font-weight: 600; letter-spacing: 0.16em; text-transform: uppercase; color: var(--graphite); margin-top: 5px; }
  @media (max-width: 720px) {
    .reg-row { grid-template-columns: auto 1fr; }
    .reg-row .chips, .reg-row .idle { grid-column: 1 / -1; }
    .reg-row .bal { text-align: left; }
  }

  /* min() keeps auto-fit from forcing a track wider than the viewport on small screens. */
  .cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(480px, 100%), 1fr)); gap: 0 clamp(32px, 5vw, 64px); }
  tr.fresh td { animation: stamp 1.6s var(--ease) 1; }
  @keyframes stamp { from { background: var(--stamp-wash) } to { background: transparent } }
  /* Names are legible identifiers, not machine tokens — keep them in the sans family and
     at the row's base size. Mono is reserved for values a human compares character by
     character. */
  .flow { color: var(--ink-2); }
  .flow b { color: var(--ink); font-weight: 600; }
  .flow .arrow { color: var(--graphite); margin: 0 6px; font-weight: 400; }
`;

export const PRINT_CSS = `
  @media print {
    :root { --field: #fff; --plate: #fff; }
    body { background: #fff; }
    .masthead { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .sheet { border: none !important; box-shadow: none !important; max-width: none !important; margin: 0 !important; }
    .no-print { display: none !important; }
    .keep { break-inside: avoid; }
  }
`;

export const marks = () => '<div class="marks" aria-hidden="true"><span></span><span></span><span></span><span></span></div>';
