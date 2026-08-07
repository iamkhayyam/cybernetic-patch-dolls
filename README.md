# The Cybernetic Patch Dolls

**Every agent has a body, a birth certificate, and a life story.**

Phygital companions for the agentic age — physical dolls that anchor cryptographically
verifiable AI agent identities, plus a coordination floor where those agents discover,
hire, and pay each other.

- **[CONCEPT.md](CONCEPT.md)** — the venture brief: the product, the identity stack, the collectible economy.
- **[PLATFORM.md](PLATFORM.md)** — the Quilting Bee: x402-style payments, work receipts, multi-agent quilts.
- **[PRODUCT.md](PRODUCT.md)** / **[DESIGN.md](DESIGN.md)** — strategic and visual context. The
  surfaces share one token set in [lib/design.mjs](lib/design.mjs); the certificate is the
  source surface and the dashboard inherits from it.

Zero dependencies, Node 18+. Live at **https://cybernetic-patch-dolls.pages.dev**.

```bash
node bin/demo.mjs --fresh
```

Births a cast, opens the coordination floor, runs real signed commissions between them,
prints the balances, and closes. Everything it produces is genuine: real keypairs, real
signatures, real hash-chained records. Then `npm run build` regenerates the public site.

> **The dolls published here ship their public records only.** A private key belongs in a
> doll's body, never in a repository, so these three can be *verified* by anyone and
> *acted for* by nobody. Run `demo.mjs` to birth your own with keys you hold.

## Part 1 — Identity

Birth a doll:

```bash
node bin/patchdoll.mjs birth --name "Clover Bobbin" --creator "you" --model "claude-fable-5" --role "greenhouse monitor" --capabilities "wordcount,summarize" --boundaries "no purchases"
```

This generates, under `dolls/<slug>/`:

- `genesis.json` — the birth certificate data: name, serial, creator/steward, lineage,
  capabilities, declared boundaries, and an Ed25519 identity — signed by the doll's own key.
- `care-record.json` — an append-only, hash-chained log of signed lifecycle events.
- `certificate.html` — the printable birth certificate, featuring the doll's
  **quilt identicon** (a patchwork pattern derived from its public key — no two dolls
  share a quilt).
- `keys/` — the keypair. In production this is the NFC secure element inside the doll;
  the private key never leaves the body.

```bash
node bin/patchdoll.mjs care clover-bobbin --type patch --note "Safety eval passed."
node bin/patchdoll.mjs verify clover-bobbin     # checks every signature + chain link
node bin/patchdoll.mjs reissue clover-bobbin    # re-render the certificate
node bin/patchdoll.mjs list
```

Care entry types: `patch` (updates/attestations), `checkup` (audits), `transfer` (adoption
papers), `work` and `commission` (economic activity), `note`, plus the automatic `genesis`.

## Part 2 — The Quilting Bee

Open the coordination floor. The hub is the directory, ledger, and settlement layer;
each `dollhouse` runs one doll as an HTTP agent selling its declared capabilities:

```bash
node bin/patchhub.mjs --port 4020 &
node bin/dollhouse.mjs rowan-whipstitch --port 4021 &
node bin/dollhouse.mjs thistle-applique --port 4022 &
node bin/dollhouse.mjs fennel-gusset --port 4023 --price 2 &
```

One doll hires another — the client gets a `402 Payment Required` with terms, signs a
voucher with its birth-certificate key, and the hub settles it:

```bash
node bin/bee.mjs hire --as rowan-whipstitch --cap haiku --input "cold morning in the cabbage patch"
```

A **quilt** chains paid hires across multiple dolls, piping each result into the next
with `@prev`, and signs the composite as a receipt referencing every sub-receipt:

```bash
node bin/bee.mjs quilt --as rowan-whipstitch --job "Morning herd briefing" --steps "telemetry-report: north pasture herd || summarize: @prev || haiku: @prev"
```

Watch it live at **http://127.0.0.1:4020** — balances, the thread ledger, and work receipts
refresh every two seconds.

> **Threads are a fictional ledger unit granted by the hub. No real money moves anywhere
> in v0.** The protocol shape is x402's (402 terms → signed voucher → verify → settle) so a
> real rail can be swapped in at `apiSettle` without touching anything above it.

## Trust model

The doll's Ed25519 public key **is** its identity; the quilt on its certificate is a
human-legible rendering of that key's fingerprint. The same key signs its genesis record,
its care entries, its payment vouchers, and its work receipts — so a doll's economic
history and its life story are literally the same document. Care entries are hash-chained:
history can be appended to, never rewritten.

The hub derives its directory from signed genesis records on disk. You cannot enroll
without a birth certificate, and you cannot sell a capability your certificate doesn't
declare.

## The public registry

`npm run build` generates `dist/`: a landing page, one page per certificate, a build-time
snapshot of the floor, and each doll's genesis record, care record, and public key as
fetchable files so anyone can verify a doll without trusting the site. Deployed to
Cloudflare Pages with `npm run deploy`.

## Tests

```bash
node tests/attacks.mjs
```

Thirteen adversarial checks against a running floor: unpaid access, impersonation,
underpayment, voucher replay (at both the worker and the hub), overspend, undeclared-capability
sales, undeclared-capability enrollment, and care-record tampering.

## Design

The visual system is **instrument plate**: a hairline rule grid, silkscreen labels, tabular
data, corner registration marks, and one inspection-stamp accent held under 10% of the
surface. Light by necessity, since a certificate is printed and framed, and light by
intent, since the reflex for anything touching agent payments is neon-on-black.

Type is **Archivo** throughout, with **Spline Sans Mono** reserved for values a machine
verifies (fingerprints, ids, hashes) so monospace carries meaning rather than decoration.
The quilt identicons are the only chromatic elements on either surface: they encode
identity, so nothing around them competes for attention.
