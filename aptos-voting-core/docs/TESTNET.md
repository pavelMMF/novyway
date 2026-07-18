# Aptos Testnet deployment

Date: 2026-07-14

## Public package address

```text
0xdd2c843725904c661a3b592e84a6794dbe2076e947b045cdc55b8cd7d4cb0411
```

Explorer: <https://explorer.aptoslabs.com/account/0xdd2c843725904c661a3b592e84a6794dbe2076e947b045cdc55b8cd7d4cb0411/modules?network=testnet>

## Transactions

| Action | Transaction |
| --- | --- |
| Publish `AptosVotingCore` | `0xbb7dfa48447d7997c01a5f7b40aba94ecf4a23edc6757431a895f6e693ebd35b` |
| Initialize governance | `0x37afe5c89d9e8406336a03a2d2bbc217219ab5e78bdeca909f528abbf7483838` |

Both transactions executed successfully on Testnet.

## Verified state

```text
is_initialized() = true
admin_threshold() = 1
versions() = (council=1, policy=1, membership=0)
```

The initial account is the sole administrator. Do not put `.aptos/config.yaml` in Git or a shared archive: it contains the private key for this Testnet account.

## Extended on-chain QA

Date: 2026-07-14

The end-to-end Testnet scenario is recorded in [TESTNET_QA_2026-07-14.md](TESTNET_QA_2026-07-14.md). It covers a live category, two qualification changes, a weighted election, fractional ballot replacement, finalization, migration from one administrator to a 2-of-3 council, and a policy change approved by the required majority.

The public state immediately after that QA scenario was:

```text
admin_threshold() = 2
versions() = (council=3, policy=3, membership=3)
election_result(0) = (finalized=true, quorum_reached=true, passed=true)
```

The QA accounts are disposable Testnet identities created only for the public 2-of-3 contract scenario. They are not registered website users:

```text
qa-admin-2-testnet = 0x319ea6093a41f15474d20d790fa0215643d27285e2145d2ca3cfb4bb717f9cd7
qa-admin-3-testnet = 0xd880ec9ae2aa8d914ccbcd11c0de214348aba07d6921d1995eaffdebd084066e
```

Their private keys remain only in the ignored local `.aptos/config.yaml` file. Both QA administrators were removed on 2026-07-16:

| Action | Transaction |
| --- | --- |
| Remove `qa-admin-2-testnet` | `0x270daed1e296934a0d6c99691db19204ec0f74b12e93a4601c982cd8290e1d48` |
| Remove `qa-admin-3-testnet` | `0xf749783614de6b1e5167c1b28cda819cd36b244960990580d28a6537e1c5a8c7` |

Current verified state: one creator administrator and threshold `1`.

## Administrator elections upgrade

On 2026-07-16 the compatible package upgrade added `admin_election` and prohibited removal of the creator from `weighted_voting`.

| Action | Transaction |
| --- | --- |
| Publish compatible upgrade | `0x02b425fd57d5f1bfb4131a639df1d24c79706c05292d5c839244591644170123` |
| Initialize `admin_election` registry | `0x126694e4c79864c2559dd8923e0ac6bebe2efebab48c993c310e2488f46ded63` |

Verified views:

```text
weighted_voting::admins() = [0xdd2c...0411]
weighted_voting::admin_threshold() = 1
admin_election::is_initialized() = true
admin_election::voter_registry() = (version=0, active=0)
```

The equal-account registry starts empty by design. The creator explicitly admits registered platform accounts before creating an equal-vote snapshot. Expert elections reuse the immutable category snapshot and weighted ballot in `weighted_voting`.

## Public document registry

The package was upgraded compatibly with the append-only `document_anchor` module.
Six public records are now anchored: five supplied project documents and one
generation-1 proof bundle. The complete classification, hashes, Testnet transaction
links, browser verification model, and recovery procedure are in
[TESTNET_DOCUMENT_REGISTRY.md](TESTNET_DOCUMENT_REGISTRY.md).

## Reproduction

```powershell
aptos move view --profile sovet-online-testnet `
  --function-id 0xdd2c843725904c661a3b592e84a6794dbe2076e947b045cdc55b8cd7d4cb0411::weighted_voting::is_initialized
```
