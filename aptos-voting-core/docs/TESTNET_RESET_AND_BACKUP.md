# Testnet reset and demo backup plan

Testnet can be reset or changed by Aptos. Treat it as a public integration environment, not permanent archival storage.

## What to preserve

After each meaningful demo operation, export a versioned, append-only record containing:

1. `manifest.json`: network, package address, deployment transaction, Git commit/tag, package artifact checksum and schema version.
2. Content assets: election text, category descriptions and exam evidence with SHA-256 checksums.
3. `operations.jsonl`: logical actions in order: categories, administrators, qualifications, policy changes, elections, final ballots and finalization. Include the original Testnet transaction hash as evidence.
4. `state-snapshot.json`: results from the public view functions after each checkpoint.
5. `migration-map.json`: after a reset, maps each old logical operation and transaction hash to its replacement transaction hash.

Keep public metadata in Git. Keep credentials and any personal information outside Git, encrypted and access-controlled.

## How recovery works

Do not replay old signed Aptos transactions. They are bound to the old chain/account sequence and cannot be valid on a reset network.

Instead:

1. Create or restore the Testnet deployment account securely.
2. Deploy the exact tagged source to a new package address.
3. Run an idempotent migration script over `operations.jsonl` in logical order.
4. Validate every checkpoint against `state-snapshot.json`.
5. Write new transaction hashes to `migration-map.json`, then publish the new package address in the website configuration.

For the current demo, the public document registry is already connected to Aptos.
`document-registry/operations.v1.jsonl`, the canonical manifest, and the anchored
generation proof bundle provide an executable logical replay path for the document
portion. Use `scripts/replay-document-anchors.ps1` only after a fresh package has
been deployed and governance initialized. Full instructions and transaction evidence
are in [TESTNET_DOCUMENT_REGISTRY.md](TESTNET_DOCUMENT_REGISTRY.md).

The browser must never hold the operator's private key. Administrative writes still
belong in an operator workflow or a small protected backend.

## Testnet APT

Faucet claims are manual because the official faucet uses Google sign-in and rate limits. Do not automate Google login or attempt to bypass faucet limits.

Fund only the dedicated fee-payer/relayer. Do not automatically transfer Testnet APT to application users: once coins reach a non-custodial account, the platform cannot restrict or reclaim them. User vote weight is encoded in Move call arguments and contract state, not in transferred APT. The relayer sponsors only allowlisted calls after sender, arguments, gas, source digest, module hashes, per-user quota and global budget checks.
