# Testnet document registry

Date: 2026-07-14

## Scope and public claim

Six records are anchored in the public Aptos Testnet package:

```text
0xdd2c843725904c661a3b592e84a6794dbe2076e947b045cdc55b8cd7d4cb0411
```

Each anchor contains a SHA-256 content hash, canonical metadata hash, byte count,
MIME type, version, and a metadata URI. The site downloads the original file,
calculates SHA-256 in the browser, and compares it against the on-chain record.

This proves a specific package administrator anchored those bytes in this Testnet
generation. It does **not** prove authorship, legal force, permanent file hosting,
or that Aptos Testnet will never reset.

## Initial publication evidence

| Action | Transaction |
| --- | --- |
| Compatible package upgrade with `document_anchor` | [0x315b...bf161](https://explorer.aptoslabs.com/txn/0x315b1d6a1a21169dff1e352404a9af1fe11d8dc5144a09e97b2c5eaf619bf161?network=testnet) |
| Initialize append-only document registry | [0x60b8...8425b](https://explorer.aptoslabs.com/txn/0x60b80aadb8b54ae309bf5474411e877b4e7ca5b5d97b6be05ab0234a61c8425b?network=testnet) |
| Anchor proof bundle for generation 1 | [0x75db...236fe](https://explorer.aptoslabs.com/txn/0x75db6dfc959079dbd90e0bbe262aeb9c984f0a6997bc624ea2f94615f53236fe?network=testnet) |

| ID | Classification | Content SHA-256 | Transaction |
| --- | --- | --- | --- |
| `nsbv-charter` | charter / governance | `ffa9313a...336a544c` | [0x9cc0...e1d62](https://explorer.aptoslabs.com/txn/0x9cc0680c273e8ddc4fba87c7b73027f2e1dbd76544d1230b5d006cb3dc1e1d62?network=testnet) |
| `draft-law-peoples-militia` | draft-law / civil-organizations | `699c86b4...b9afcea` | [0x8a8c...badd6](https://explorer.aptoslabs.com/txn/0x8a8c1237e157818c17217178e75a5d90b86f7ac5a6c7fa4d772fe8dbdcdbadd6?network=testnet) |
| `voting-weight-calculator` | calculation-model / voting-system | `9e68a5ad...3540dbe7` | [0x4600...231d1](https://explorer.aptoslabs.com/txn/0x4600bfbeca78a01e81a9541e801694212062893361662ecc387199ca6fe231d1?network=testnet) |
| `voting-system-council-charter` | charter / voting-system | `ccbdac20...07391a52` | [0xa67a...1f38d](https://explorer.aptoslabs.com/txn/0xa67a387678072fbeb1032cf0569665ec0fb6822e2033123034466d16d3c1f38d?network=testnet) |
| `vote-weight-methodology` | methodology / voting-system | `a60b2534...8dc0f71b` | [0xdf1f...86771](https://explorer.aptoslabs.com/txn/0xdf1f33c0d2f5667c0ef451f3cec98df998c3419ee568dfbd717f3768e0486771?network=testnet) |
| `testnet-generation-1-proof` | audit-log / governance | `36dc0c23...fb0a136f` | [0x75db...236fe](https://explorer.aptoslabs.com/txn/0x75db6dfc959079dbd90e0bbe262aeb9c984f0a6997bc624ea2f94615f53236fe?network=testnet) |

## Repository artifacts

- `document-registry/manifest.v1.json`: canonical registry manifest.
- `document-registry/publish-plan.v1.json`: exact inputs for five document anchors.
- `document-registry/proofs/testnet-generation-1-proof.json`: source archive hash, manifest hash, five logical operations and transaction references.
- `document-registry/operations.v1.jsonl`: logical operation log with idempotency keys.
- `document-registry/anchors/*.json`: canonical public metadata sidecars.

The proof file has SHA-256 `36dc0c233ea9f490f1900e8d7949ce2fb44f0e56baddcbfa663fefddfb0a136f`.
The proof anchor transaction is intentionally not placed inside that proof file: doing
so would create a circular hash. The explorer transaction above proves the final
proof bytes were anchored.

## Independent check

1. Open the Documents page of the site. Each row says whether the original binary,
   canonical metadata, size, and MIME type match the Testnet anchor.
2. Or use the Aptos CLI to inspect the count and individual anchors:

```powershell
$address = '0xdd2c843725904c661a3b592e84a6794dbe2076e947b045cdc55b8cd7d4cb0411'
aptos move view --profile sovet-online-testnet --function-id "$address`::document_anchor::anchor_count"
aptos move view --profile sovet-online-testnet --function-id "$address`::document_anchor::anchor" --args 'u64:0'
```

Anchor IDs `0` through `5` are in the table order above.

## Recovery after a Testnet reset

Never replay an old signed transaction: it is tied to its original chain state and
account sequence. Recreate the **logical operations** instead.

1. Preserve this repository, the five original source files, the proof bundle, and
   the transaction links in a Git tag or another independent public archive.
2. Deploy the compatible package and initialize `weighted_voting` on the new Testnet
   account. Record its new module address.
3. Run a dry run first:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\replay-document-anchors.ps1 `
  -TargetModuleAddress '<new-package-address>' -WhatIf
```

4. Initialize and replay the document registry. Every new anchor receives the SHA-256
   of this generation-1 proof bundle as `recoveryBundleHash`:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\replay-document-anchors.ps1 `
  -TargetModuleAddress '<new-package-address>' -Initialize
```

5. Create `migration-map.json` with old and new transaction hashes; update the web
   app's `VITE_APTOS_MODULE_ADDRESS`; tag the new generation.

The recovery script only performs the document registry portion. Recreate governance
and voting-state operations from their separately maintained operation log and state
snapshots; do not invent missing historical user operations.
