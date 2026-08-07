# Product

## Register

brand

## Users

Three audiences, in order of how much the design owes them:

1. **Stewards** — the humans named on a doll's certificate. They unbox a physical doll,
   print or frame its birth certificate, and check in on it the way you'd check a pet's
   vaccination card. Non-technical, emotionally invested, reading in daylight at a table.
2. **Operators** — people running dolls as working agents (a ranch, a greenhouse, a lab).
   They scan the Quilting Bee for balances, ledger movement, and whether a doll is online.
   Technical, task-focused, glancing rather than reading.
3. **Skeptics** — auditors, buyers on a secondary market, anyone asking "is this real?"
   They arrive at a certificate cold and need to reach "this is verifiable" fast.

The job to be done: **make a cryptographic identity feel like something you own and are
responsible for.** Not a wallet address. Not a dashboard row. A record with a face.

## Product Purpose

The Cybernetic Patch Dolls binds an AI agent's identity, accountability, and economic
activity to a single key, anchored by a physical object. Certificates prove origin and
stewardship; care records prove history; the Quilting Bee lets dolls hire and pay each
other, leaving signed receipts.

Success looks like a steward hanging a certificate on a wall, and an auditor trusting it
for reasons that have nothing to do with how it looks.

## Brand Personality

**Machined, archival, tender.**

The record is machined; the thing it describes is soft. That tension is the brand. This is
a calibration certificate for a toy, a metrology plate riveted to something you love. The
voice is institutional but never cold, precise but never sterile, and it never winks at
the cuteness. Play it completely straight and the warmth arrives on its own.

Copy is declarative and unhedged. The registry states facts and cites signatures. It never
sells, never exclaims, never says "powered by" anything.

## Anti-references

- **Crypto and web3 aesthetics.** No neon-on-black, no glow, no gradient meshes, no
  hexagon avatars, no "sign in with wallet" energy. This is the single strongest anti-goal:
  the category reflex would make it look exactly like what it is trying not to be.
- **Fintech dashboards.** No navy-and-gold, no big-number hero metric with a sparkline,
  no four identical stat cards in a row.
- **Startup SaaS landing pages.** No centered hero, no icon-title-blurb card grid, no
  rounded-corner icon above every heading.
- **Nursery cute.** No pastel, no bubble type, no mascot. The dolls are collectibles with
  legal weight, not a baby shower.
- **Faux-vintage parchment.** The v0 surfaces used cream, ruled borders, and Georgia.
  Retired deliberately. Ceremony should come from structure and precision, not from
  pretending to be old.

## Design Principles

1. **The document is the product.** A certificate is the thing people keep. Design it as
   an object first (print-first, archival, unambiguous), and let every other surface
   inherit from it.
2. **Precision is the ornament.** Rules, registration marks, tabular figures, and exact
   alignment do the decorative work. Nothing is added that doesn't also mean something.
3. **The quilt carries the color.** Identicons are the only chromatic events on the page,
   because they are the only element that encodes identity. Everything around them recedes
   so they can be read and compared.
4. **Never imply personhood.** Typography, copy, and layout describe an object with a
   responsible owner. No anthropomorphic framing, no first-person voice for dolls.
5. **Show the proof, not a badge for it.** Signatures, hashes, and chain links appear as
   legible values, never as a green checkmark that asks to be trusted.

## Accessibility & Inclusion

- WCAG 2.2 AA minimum. Body text targets 7:1 where practical, given the surface is often
  printed or read at a distance.
- **Color is never the only signal.** Online/offline, verified/failed, and credit/debit
  each carry a shape, label, or position in addition to any hue. Identicons are decorative
  duplicates of a fingerprint that is always printed in text beside them.
- The single accent hue is distinguishable under the common color-vision deficiencies;
  it is never used to separate two states from each other.
- `prefers-reduced-motion` removes all transitions. No motion is load-bearing.
- Print stylesheet is a first-class target, not an afterthought.
