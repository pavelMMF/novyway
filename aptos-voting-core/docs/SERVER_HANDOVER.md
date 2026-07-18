# Laptop hosting and server handover

## Is a laptop acceptable now?

Yes, for the current Testnet demo. The laptop serves a static website and public
document files. It is not the blockchain and does not hold the public voting history:
the Aptos package and document anchors remain public if the laptop is off.

The trade-off is availability. When the laptop sleeps, loses power, changes network,
or restarts, the web page is unavailable. For an internet-facing demo, serve only the
production `dist` files behind HTTPS; do not expose Vite's development server or an
operator key.

For this laptop, a one-click console launcher is available at
`novyway/Start-Sovet-Online.exe`. Double-click it after a
restart. It rebuilds the website when required, opens the local browser, serves
`http://127.0.0.1:4176/`, and keeps its console open until `Ctrl+C` stops the server.
The default loopback address is intentional: it does not expose the laptop to the
local network or the internet.

## Create a portable handover bundle

From `aptos-voting-core` on the current laptop:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\create-portable-handover.ps1
```

The output appears in `..\handover\` as a ZIP and a `.sha256` sidecar. It contains:

- website source, lockfile and public document files;
- Move source, document manifest, proof bundle, transaction evidence and recovery scripts;
- a per-file SHA-256 manifest.

It deliberately excludes `.aptos`, `.env.local`, `node_modules`, build folders, Git
metadata and logs. Do not add `.aptos/config.yaml` to this archive: it contains the
operator private key.

On the destination machine, unpack the ZIP and validate it:

```powershell
Get-FileHash .\sovet-online-handover-*.zip -Algorithm SHA256
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\aptos-voting-core\scripts\verify-portable-handover.ps1 `
  -Directory .\sovet-online-handover-<label>
```

## Deploy the static site on the new host

1. Install a current Node.js LTS release.
2. In the unpacked `web` folder, create `.env.local` with public values only:

```text
VITE_RUNTIME_MODE=aptos-testnet
VITE_APTOS_MODULE_ADDRESS=0xdd2c843725904c661a3b592e84a6794dbe2076e947b045cdc55b8cd7d4cb0411
VITE_APTOS_NETWORK=testnet
```

3. Run `npm ci` and `npm run build`. Deploy only `web/dist` through Caddy, Nginx, or
   another HTTPS static-file server.
4. Configure SPA fallback to `index.html`, then point the domain/DNS to the new host.

The static web host needs no Aptos account, private key, or database. Keep the
operator profile on a separate encrypted machine or hardware-encrypted removable
storage. When an administrative write workflow is added later, it belongs in a
protected backend, not in this static site.

## Testnet reset continuity

The portable bundle contains the anchored proof generation and logical replay inputs.
After a Testnet reset, deploy the package again, initialize governance, and follow
[TESTNET_DOCUMENT_REGISTRY.md](TESTNET_DOCUMENT_REGISTRY.md). Old signed transactions
cannot be reused; the replay creates fresh transaction hashes tied to the old proof.
