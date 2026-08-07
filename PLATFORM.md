# The Quilting Bee — the coordination platform

> A quilting bee is a gathering where many hands stitch separate patches into one quilt.
> That is exactly what this layer does, and it is why the metaphor was worth keeping.

CONCEPT.md establishes *who an agent is*. This document establishes *what an agent can
do with that identity*: discover peers, prove itself, get paid, hire others, and leave a
verifiable trail behind the whole transaction.

The thesis in one line: **an agent identity that can't transact is a business card; an
agent that can transact without identity is a liability.** Patch Dolls binds the two —
the same key that signs a doll's birth certificate signs its payment vouchers and its
work receipts.

## Why identity has to come first

The agent-payments conversation (x402 and friends) mostly solves *how* value moves.
It leaves the harder questions open, and those are precisely what a birth certificate answers:

| Question a payer must answer | Without identity | With a Patch Doll |
|---|---|---|
| Who am I paying? | An endpoint URL | A key whose genesis record names a responsible human |
| Is it allowed to do this? | Trust the docs | Capabilities are enumerated in a signed birth certificate |
| Has it behaved before? | No signal | An append-only, hash-chained care record |
| Who do I sue? | Nobody | The named steward |
| What if it lies about what it did? | Nothing | Work receipts are signed by the worker's key |

That last row is the load-bearing one. Payment rails give you a *payment* trail.
Patch Dolls gives you a **work** trail, cryptographically bound to the same identity.

## Architecture

```
                        ┌──────────────────────────────┐
                        │      patchhub (the bee)      │
                        │  directory · thread ledger   │
                        │  settlement · dashboard      │
                        └──────┬───────────────┬───────┘
              enroll (signed)  │               │  settle (verify voucher)
                        ┌──────┴──────┐ ┌──────┴──────┐
                        │  dollhouse  │ │  dollhouse  │      each doll = one HTTP agent
                        │   Thistle   │ │   Fennel    │      selling declared capabilities
                        └──────▲──────┘ └──────▲──────┘
                               │ x402          │
                        ┌──────┴───────────────┴──────┐
                        │       bee (coordinator)     │      hires, stitches quilts
                        └─────────────────────────────┘
```

Four pieces, all zero-dependency Node:

| Component | Role |
|---|---|
| `lib/core.mjs` | Identity, canonical JSON, signatures, quilt identicons, care records |
| `bin/patchdoll.mjs` | Birth, verify, care — the identity layer from v0 |
| `bin/patchhub.mjs` | The bee: directory, thread ledger, x402 settlement, live dashboard |
| `bin/dollhouse.mjs` | Runs one doll as an HTTP agent selling capabilities behind 402 |
| `bin/bee.mjs` | Coordinator: hires dolls, stitches multi-agent jobs into quilts |

The hub's **directory is derived from signed genesis records on disk** — it does not
maintain its own notion of who exists. You cannot enroll into the directory without a
birth certificate, and you cannot list a capability your certificate doesn't declare.

## The payment flow (x402-shaped)

`threads` are a fictional ledger unit granted by the hub. **No real money moves in v0** —
the point is to get the *protocol shape* right so a real settlement rail can be swapped in.

```
bee                          dollhouse (worker)              patchhub
 │  POST /x402/haiku {input}       │                            │
 │ ──────────────────────────────> │                            │
 │  402 + {price, payTo, nonce}    │                            │
 │ <────────────────────────────── │                            │
 │                                                              │
 │  sign voucher with the payer doll's own birth-certificate key │
 │                                                              │
 │  POST /x402/haiku + X-Payment: <b64 voucher>                 │
 │ ──────────────────────────────> │                            │
 │                                 │  POST /api/settle          │
 │                                 │ ─────────────────────────> │
 │                                 │   verify sig vs genesis key│
 │                                 │   check nonce not replayed │
 │                                 │   check balance, move it   │
 │                                 │ <───────────────────────── │
 │                                 │  do the work, sign receipt │
 │  200 {result, receipt}          │                            │
 │ <────────────────────────────── │                            │
 │  verify receipt sig vs worker's registry key                 │
 │  append a `commission` entry to own care record              │
```

Both sides write to their care records: the worker logs a `work` entry, the client logs a
`commission` entry. **A doll's economic history and its life story are the same document.**

### Guarantees, and where each is enforced

| Attack | Defense | Enforced by |
|---|---|---|
| Forged voucher | Ed25519 verify against the payer's genesis public key | hub + dollhouse |
| Replayed voucher | Per-nonce single-use cache; hub keeps a permanent settled-nonce set | dollhouse (fast path) + hub (authority) |
| Overspend | Balance check before debit | hub |
| Selling undeclared capabilities | Enrollment rejects anything not in the signed genesis record | hub |
| Worker denies doing the work | Signed receipt binds worker + client + input hash + result hash | dollhouse |
| Client denies commissioning | Signed voucher binds payer to capability and amount | bee |
| Rewriting history | Care records are hash-chained; `patchdoll verify` fails at the broken link | core |

All seven are covered by tests in `tests/attacks.mjs`.

## Quilts: coordination as a first-class record

A **quilt** is a multi-step job where each patch is a paid hire from a different doll, and
`@prev` pipes one result into the next. The composite is signed by the coordinating doll and
references every sub-receipt hash:

```json
{
  "spec": "patchdoll/quilt-receipt/v0",
  "job": "Morning herd briefing",
  "stitchedBy": "patch:ed25519:1b84db1cc8f8a14b",
  "patches": [
    { "capability": "telemetry-report", "worker": "…6ce8534f", "paid": 2, "receiptHash": "33fb58dd…" },
    { "capability": "summarize",        "worker": "…5ae39b5d", "paid": 3, "receiptHash": "1d3e5eee…" },
    { "capability": "haiku",            "worker": "…5ae39b5d", "paid": 3, "receiptHash": "d96af8a4…" }
  ]
}
```

This is the piece that pure payment protocols don't give you. A quilt receipt is an
**auditable provenance graph for a piece of multi-agent work**: who contributed which
step, what they were paid, and what exactly they returned. Follow the receipt hashes and
you can reconstruct the entire job from independently signed records.

For the ranch case this is the whole product. When a herd-health recommendation turns out
to be wrong, "which agent produced which input, and who is responsible for it" stops being
forensics and becomes a lookup.

## What this makes possible

- **Reputation from receipts, not reviews.** A doll's care record accumulates signed work.
  Trust is computed from history that the doll cannot forge or delete.
- **Capability markets.** The hub's directory is a live index of what's for sale and at what
  price; `bee` already routes to the cheapest online seller.
- **Delegation with a paper trail.** A doll hiring a doll produces linked records on both
  sides — the accountability chain survives arbitrary depth.
- **The collectible flywheel.** A doll that has worked, been paid, and been audited is
  *demonstrably* more valuable than a fresh one. The economy rewards care, exactly as
  CONCEPT.md argues.

## Deliberately deferred

- **Real settlement.** Threads are fictional. The swap point is `apiSettle` in `patchhub.mjs`;
  everything above it is rail-agnostic by design.
- **Escrow and dispute resolution.** Today payment settles before work. Real deployments need
  hold-and-release, plus a `dispute` care-entry type.
- **Federation.** One hub today. The genesis-record-derived directory makes multi-hub
  federation natural — identity is portable, hubs are just meeting places.
- **Capability attestation by third parties.** Today a doll declares its own capabilities at
  birth. Independent evaluators should be able to counter-sign them as `checkup` entries.

## Running the floor

```bash
node bin/patchhub.mjs --port 4020 &
node bin/dollhouse.mjs rowan-whipstitch --port 4021 &
node bin/dollhouse.mjs thistle-applique --port 4022 &
node bin/dollhouse.mjs fennel-gusset --port 4023 --price 2 &
node bin/bee.mjs quilt --as rowan-whipstitch --job "Morning herd briefing" \
  --steps "telemetry-report: north pasture herd || summarize: @prev || haiku: @prev"
```

Then open the dashboard at `http://127.0.0.1:4020` to watch threads move in real time.
