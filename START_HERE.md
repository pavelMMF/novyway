# NOVYWAY: AI HANDOFF

Updated: 2026-07-18. Read this file first. Open only the files named for the task; do not rescan the whole repository.

## Repository map

| Path | Purpose |
| --- | --- |
| `novyway/` | Active React/Vite site, Node API, PostgreSQL access and Windows operator app |
| `aptos-voting-core/` | Active Aptos Move package, tests, deployment evidence and document registry |
| `governance_docs_2026-07-16/` | Editable source documents and their generation/QA scripts |
| `.tools/` | Local Aptos CLI/FFmpeg; ignored by Git |

There is one Git repository at this root. There is no nested Git repository. Legacy/history/build archives were moved to:

`C:\Users\lolip\OneDrive\Documents\Novyway-Legacy-20260718`

## Current runtime

- Product/brand: Novyway / «Новый Путь».
- Public site: `https://novyway.com` through Cloudflare Tunnel.
- Site/API: `127.0.0.1:4176`; operator API: loopback-only `127.0.0.1:4177`.
- PostgreSQL 17: `127.0.0.1:55432`, data outside Git in `%LOCALAPPDATA%\SovetOnline`.
- Start/restart: `novyway\Start-Sovet-Online.exe`.
- Local infrastructure console: `novyway\Sovet-Online-Admin.exe`.
- On-site governance console: `https://novyway.com/#/admin`. It is a different system from the local operator app.

Names `SovetOnline`, `sovet_online` and the two EXE filenames are compatibility identifiers for existing local data, DB and shortcuts. Do not rename them casually.

## Aptos truth

- Network: Aptos Testnet, chain ID `2`.
- Package/creator/only super-admin: `0xdd2c843725904c661a3b592e84a6794dbe2076e947b045cdc55b8cd7d4cb0411`.
- Modules: `weighted_voting`, `admin_election`, `document_anchor`.
- Published source digest: `120BF272B9879B1FCF8FA97B6124EFD2A55E028D306A881AEE1ABCC8356E5516`.
- Exact package/module hashes: `aptos-voting-core/deployment/testnet-package.json`.
- Six document anchors are already published and verified; do not republish duplicates.
- Verify anchors: `node aptos-voting-core/scripts/verify-testnet-document-registry.mjs`.
- Canonical registry/replay data: `aptos-voting-core/document-registry/`.

On-chain truth: creator/admin membership, categories, policies, qualifications, snapshots, weighted ballots, admin elections and document hashes.

PostgreSQL truth: users, linked login methods, sessions, profiles, encrypted managed-wallet envelopes, sponsored intents, operator events and logic-game scores.

Browser demo state: draft categories, graph spaces/links and unfinished governance editors under `novyway/src/demo/`. These are the “demonstration drafts”; they are not published decisions or blockchain truth.

## Sponsorship

Do not auto-fund user wallets. APT sent to a noncustodial wallet cannot be restricted by the super-admin.

The server uses Aptos fee-payer transactions instead:

- sender signs the exact governance transaction; relayer pays gas;
- allowlist contains only `weighted_voting::cast_vote` and `admin_election::cast_equal_vote`;
- network, module, function, typed arguments, sender, fee payer, gas and expiry are validated again before submission;
- published source digest and all three module bytecode hashes must match;
- current limits: 20 submissions/user/hour and 250 submissions globally/hour;
- PostgreSQL claim is atomic; idempotency prevents duplicate submission;
- operator setting and `SPONSORSHIP_EMERGENCY_LOCK=1` can stop sponsorship.

Voting weight is in transaction arguments and the frozen election snapshot, not in the amount of APT transferred.

## Where to edit

- Routes: `novyway/src/App.tsx`.
- Screens: `novyway/src/screens/`.
- Shared UI/layout: `novyway/src/ui/`.
- Styles/tokens: `novyway/src/styles/`.
- Aptos reads: `novyway/src/adapters/aptos/`.
- Auth/session/wallet UI: `novyway/src/auth/`, `novyway/src/ui/components/AuthPanel.tsx`.
- Public API/auth/ops routes: `novyway/server/static-server.mjs`.
- PostgreSQL schema/queries: `novyway/server/lib/storage.mjs`.
- Aptos relayer: `novyway/server/lib/aptos-service.mjs`, `sponsored-intent.mjs`.
- Move source/tests: `aptos-voting-core/sources/`, `aptos-voting-core/tests/`.
- Contract API/architecture: `aptos-voting-core/docs/API.md`, `ARCHITECTURE.md`.
- Operations/security: `novyway/docs/OPERATIONS_ACCOUNTS_AND_RELAYER.md`, `PRODUCTION_SECURITY_AND_MIGRATION.md`.
- Product/UI description: `novyway/docs/SITE_DOCUMENTATION.md`.

## Verification commands

From `novyway/`:

```powershell
pnpm.cmd install --frozen-lockfile
npm.cmd run lint
npm.cmd run build
npm.cmd run verify:sponsored-intent
npm.cmd run verify:siwa
npm.cmd run verify:logic
npm.cmd run verify:credentials
npm.cmd run verify:logic:storage
npm.cmd run verify:creator
npm.cmd run verify:recovery
npm.cmd run verify:session   # requires the local server on port 4176
```

From `aptos-voting-core/`:

```powershell
& ..\.tools\aptos\aptos.exe move test --package-dir . --named-addresses "aptos_voting=0x42" --coverage --fail-on-warning
node scripts\verify-testnet-document-registry.mjs
```

Expected baseline: web lint/build pass; 150 logic challenges; 24/24 Move tests pass; 6/6 document anchors match; package source and all module hashes match Testnet.

Health checks:

```powershell
Invoke-RestMethod http://127.0.0.1:4176/__health
Invoke-RestMethod https://novyway.com/api/config
```

## Security rules

Never read, print, copy to chat or commit:

- `novyway/.env.local`;
- `aptos-voting-core/.aptos/`;
- `%LOCALAPPDATA%\SovetOnline\secrets`, `postgres-data`, `backups`, `logs`;
- private keys, SMTP app password, PostgreSQL password, operator key or email codes.

Never commit generated/local state: `node_modules`, `dist`, `build`, `.runtime`, `.tools`, `.playwright-cli`, `release`, EXE, ZIP or local music. The root `.gitignore` enforces this.

Passwords use `scrypt`; managed private keys use AES-256-GCM with a key outside the repository; email/reset codes are stored only as keyed hashes; sessions use HttpOnly cookies plus CSRF checks.

The creator cannot be removed by the current Move contract. The current PostgreSQL registry has one user and one super-admin; do not invent additional admins or demo identities.
