# Design

## Visual Theme

**Instrument plate.** The reference lane is Swiss metrology documentation and Braun-era
equipment faceplates: a hairline rule grid, silkscreen-small labels in wide tracking,
tabular data, registration marks at the corners, and one inspection-stamp accent. A
certificate should read like the calibration record that ships with a precision instrument
— which is exactly what it is, for an agent.

**Light, always.** Not a default: the certificate is a printed, framed, archived object,
and you cannot print a dark theme. The dashboard inherits light because it is the same
registry seen live. This is also the deliberate opposite of the category reflex — agent
payments and cryptographic identity pull hard toward neon-on-black, and going there would
make the product look like the thing it is trying not to be.

The dominant structural move is a **near-black masthead band** against a pale instrument
field. That block carries the boldness so the palette doesn't have to compete with the
identicons.

## Color

OKLCH throughout. Strategy is **Restrained** — tinted neutrals plus one accent held under
10% of surface area. This is an argued position, not timidity: quilt identicons are
full-palette objects that *encode identity*, so they must be the only chromatic events on
the page. Any committed background color would compete with the one element that has to be
read and compared precisely.

Neutrals are tinted warm-neutral (hue ~65) at very low chroma. They read as instrument
grey and anodized metal, never as cream or parchment.

| Token | Value | Use |
|---|---|---|
| `--ink` | `oklch(0.19 0.012 62)` | Masthead band, primary type, heavy rules |
| `--ink-2` | `oklch(0.33 0.010 62)` | Secondary type, table values |
| `--graphite` | `oklch(0.52 0.008 65)` | Labels, metadata, de-emphasized values |
| `--field` | `oklch(0.955 0.004 75)` | Page background |
| `--plate` | `oklch(0.988 0.003 75)` | Raised surfaces, table bodies, the certificate face |
| `--rule` | `oklch(0.875 0.005 70)` | Hairline rules, table dividers |
| `--rule-strong` | `oklch(0.76 0.006 70)` | Section boundaries, plate edges |
| `--stamp` | `oklch(0.575 0.20 32)` | The inspection-stamp accent |
| `--stamp-wash` | `oklch(0.575 0.20 32 / 0.08)` | Row flash, live-state fill |

Never `#000` or `#fff`. `--ink` is the darkest value in the system; `--plate` the lightest.

**`--stamp` is a single-purpose color.** It marks *authority and liveness only*: the
registry seal, the "at the bee" indicator, the current-row flash, and the rule under a
masthead. It is never used for positive/negative, credit/debit, or pass/fail — those carry
labels and position instead, so the palette stays legible under color-vision deficiency.

## Typography

### Selection

Voice words: **machined, archival, tender.** Reflex picks were Inter, Space Grotesk, and
IBM Plex Sans; all three are training-data defaults and were rejected. The physical object
searched for was a museum specimen label and an equipment spec plate.

- **Archivo** (variable, 100–900) — every sans role. Chosen for its name's literal brief
  (a grotesque drawn for print and archival record), its very wide weight axis, which
  supplies the hierarchy without a second family, and genuine tabular figures for ledgers.
- **Spline Sans Mono** — cryptographic strings *only*: fingerprints, doll ids, voucher and
  receipt hashes, serials. Mono is semantic here, not costume. It marks the class of value
  that a machine verifies and a human compares character by character.

Both load from Google Fonts with a robust system fallback. Nothing in the layout depends
on their exact metrics, so an offline certificate degrades to a system grotesque without
breaking.

### Scale

Modular, ratio ≥1.25, fluid via `clamp()` on display sizes.

| Step | Size | Weight / tracking |
|---|---|---|
| `--t-display` | `clamp(2.4rem, 6vw, 4rem)` | 800, `-0.03em` |
| `--t-title` | `clamp(1.4rem, 2.6vw, 1.9rem)` | 700, `-0.02em` |
| `--t-lead` | `1.0625rem` | 400 |
| `--t-body` | `0.9375rem` | 400 |
| `--t-data` | `0.875rem` | 500, tabular |
| `--t-label` | `0.6875rem` | 600, `0.14em`, uppercase |
| `--t-micro` | `0.625rem` | 600, `0.16em`, uppercase |

Labels are the silkscreen layer: uppercase, wide-tracked, `--graphite`, always small.
Body copy caps at 68ch.

## Layout

A **strict, visible grid is the voice** — the tech-spec/Swiss lane, not asymmetric
editorial. Structure reads as confidence here because the product's whole claim is
precision.

- Hairline rules (`1px --rule`) separate every logical group. Rules are the primary
  structural device; boxes and cards are the exception.
- **Registration marks** (short corner crops) frame the certificate plate and the dashboard
  masthead, borrowed from print production.
- The certificate is a two-column plate: identicon and fingerprint mounted left, name and
  the label/value grid right. Not centered.
- The dashboard is full-width ruled rows, never a card grid.
- Spacing scale: `4 / 8 / 12 / 16 / 24 / 32 / 48 / 72 / 112px`. Vary it — tight inside
  groups, generous between sections.

### Banned here specifically

Identical card grids, four-across stat boxes, side-stripe accent borders, gradient text,
glass, nested cards, centered hero stacks.

## Components

- **Masthead band** — full-bleed `--ink` block, reversed type, `--stamp` hairline beneath.
  Shared by both surfaces; the primary continuity device.
- **Specimen plate** — the identicon mounted with a hairline border and its fingerprint set
  in mono directly beneath. The identicon is decorative; the fingerprint text is the record.
- **Label/value grid** — two columns, `--t-label` left, value right, hairline rule per row.
- **Register row** — full-width doll listing: plate, identity block, capability chips,
  right-aligned balance. Replaces cards on the dashboard.
- **Capability chip** — hairline-bordered rectangle, no radius, label plus mono price.
- **Data table** — hairline rules, `--t-label` headers, tabular figures, mono for hashes.
- **Status strip** — a single ruled horizontal bar of inline readouts. Replaces the stat-box
  row; deliberately not a hero-metric template.

Border radius is `0` system-wide. Every corner is square; the softness in this product
lives in the object, never in the record.

## Motion

Minimal by policy. `--ease: cubic-bezier(0.22, 1, 0.36, 1)` (ease-out-quart), `140ms` for
state changes, `320ms` for entrances. Only `opacity`, `transform`, and `background-color`
animate.

The one expressive moment: a new ledger row arrives with a brief `--stamp-wash` flash that
decays to transparent, echoing a stamp being pressed. `prefers-reduced-motion: reduce`
removes all of it, including the flash.

## Print

First-class target for the certificate. The masthead prints as a solid band, the field
drops to white, registration marks are retained, and the signature block stays on the page
with the record it signs.
