# The Cybernetic Patch Dolls

**Phygital companions for the agentic age.** Every agent has a body, a birth certificate, and a life story.

Cabbage Patch Kids for AI agents — except the doll isn't merch. The physical object is the agent's **root-of-trust token**: a tangible anchor for a cryptographically verifiable identity, a signed birth certificate, an append-only care record, and an evolving personality.

## Why the name works

**Cybernetic** is literal, not decorative: cybernetics is the study of control and feedback in systems of machines and living things — exactly what the care record captures, and exactly the livestock/ranch deployment story. And a **patch** is three things at once, all three of them the product:

1. **A quilt square.** Each doll's visual identity is a patchwork quilt derived from its public key — a soft, human-legible identicon. No two dolls share a quilt.
2. **A software update.** The doll's maintenance history — security patches, evaluations, capability changes — is literally its *patch history*, recorded as a signed, hash-chained care record.
3. **A patch of ground.** The cabbage patch. Dolls are *born*, not manufactured; adopted, not bought.

## The identity stack (three layers, kept separate)

The design mistake to avoid is collapsing these into one thing:

| Layer | Question it answers | Mechanism | Mutable? |
|---|---|---|---|
| **Identity** | What is this agent? | Ed25519 keypair; the public key *is* the agent's ID. Fingerprint rendered as the quilt. | Never. Key rotation = a signed lifecycle event, not a new identity. |
| **Accountability** | Which human/legal entity answers for it? | Named steward in the genesis record; transfers are signed "adoption papers." | Yes, via signed transfer. |
| **Personality** | What makes this one feel individual? | Name, traits, memory profile, care history. | Evolves freely; changes are logged, not signed away. |

The birth certificate establishes **origin and responsibility** — it is explicitly *not* a claim of legal personhood. The certificate anchors provenance and accountability; the personality layer is where the emotional product lives. Keeping them separate means the cute layer can be playful without the trust layer becoming a toy.

## The physical object

Not merch — the hardware anchor:

- **NFC secure element** holds (or attests to) the private key. Tapping the doll is how you prove you hold the body. In the v0 software prototype, the keypair lives on disk with a marked slot for where the secure element goes.
- **Serial number** (`PD-0001`, …) stamped on a data plate; the registry maps serials to public keys.
- **Printed birth certificate** ships in the box: archival stock, the quilt identicon, the genesis record's fingerprint, a signature block. The QR/URL is convenience; the signature is the trust.
- The object sits somewhere between **toy, passport, hardware wallet, pet tag, and archival certificate** — and the industrial design should feel like all five.

## Lifecycle ontology

| Physical-world metaphor | Patch Dolls equivalent | Record type |
|---|---|---|
| Birth certificate | Signed genesis record | `genesis` |
| Adoption papers | Steward transfer | `transfer` |
| Vaccination record | Security patches, evals, safety attestations | `patch` |
| Pedigree | Model / dataset / parent-agent lineage | in `genesis.lineage` |
| Vet record | Audits, incidents, maintenance | `checkup` |
| Death certificate | Retirement / key revocation / cryptographic sunset | `sunset` |
| Offspring | Forked or recombined agents citing parent signatures | child's `genesis.lineage.parents` |

Every entry in the care record is signed by the doll's key and hash-chained to the previous entry — you can't quietly rewrite a doll's history, only append to it.

## Collectible economy (provenance, not scarcity)

Value comes from *documented life*, never artificial rarity:

- **Founders** — first generation from a given model or project.
- **Lineage dolls** — documented offspring of two parent agents.
- **Field agents** — dolls whose care records prove real deployment (a ranch sensor herd, a greenhouse, a lab). This is the livestock/cybernetics extension: the certificate says what hardware or animals the agent is attached to, what data it touches, and who answers for it.
- **Retired dolls** — sunset agents preserved at an immutable final state.
- **Mutations** — authorized capability upgrades, visible in the patch history.

A doll that spent two years monitoring a cattle herd, with the checkups to prove it, is worth more than a mint-in-box one. That inverts normal collectible logic — and it's the point: the economy rewards *care*.

## What to deliberately avoid

- **No blockchain requirement.** Signatures + an append-only registry give the trust properties without the grift smell. Chain-anchoring can be an optional attestation later.
- **No personhood theater.** The certificate names a responsible human. Always.
- **No pay-to-win rarity.** Scarcity emerges from lifecycle events, never from a drop schedule.
- **The QR code is not the product.** Anything a QR resolves must be independently verifiable from the signed records.

## Roadmap

1. **v0 (this repo):** CLI that births dolls — keypair, signed genesis, hash-chained care record, printable certificate with quilt identicon. Prove the record format.
2. **v1:** Public registry (serial → pubkey → record history), web verifier, adoption-transfer flow.
3. **v2:** Hardware pilot — NFC secure element in a small production run of physical dolls; tap-to-verify.
4. **v3:** Field-agent program — certificates for deployed agents on real hardware (ag/livestock first), where the care record has operational, not just sentimental, value.

The deeper play: Patch Dolls is the **cultural interface for machine identity** — making credentials, provenance, and agent governance legible through objects people can hold, name, display, inherit, and care for.
