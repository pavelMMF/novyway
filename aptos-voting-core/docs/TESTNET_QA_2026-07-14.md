# Aptos Testnet QA record

Date: 2026-07-14
Network: Aptos Testnet
Package: `0xdd2c843725904c661a3b592e84a6794dbe2076e947b045cdc55b8cd7d4cb0411`

This document records public Testnet evidence only. It contains no private keys, recovery phrases, or user data.

## Local contract suite

```text
aptos move test --named-addresses aptos_voting=0x42 --coverage --fail-on-warning
16 passed, 0 failed
Move coverage: 67.55%
```

The tests cover initialization, thresholds, qualification voting, snapshot weights, floors, degradation, quorum, fractional ballot validation, revoting and policy validation.

## On-chain scenario

| Step | Evidence transaction |
| --- | --- |
| Publish package | [`0xbb7…bd35b`](https://explorer.aptoslabs.com/txn/0xbb7dfa48447d7997c01a5f7b40aba94ecf4a23edc6757431a895f6e693ebd35b?network=testnet) |
| Initialize governance | [`0x37af…3838`](https://explorer.aptoslabs.com/txn/0x37afe5c89d9e8406336a03a2d2bbc217219ab5e78bdeca909f528abbf7483838?network=testnet) |
| Create category 1 | [`0x5419…3efc`](https://explorer.aptoslabs.com/txn/0x541965188c24e0c7bcc95699e08686e636dbf7322ee4fe20dfec6c3bbc273efc?network=testnet) |
| Qualify creator at level 0 | [`0x3794…6933`](https://explorer.aptoslabs.com/txn/0x3794757338d171aa6bc63c9713bfcdf311f0ed03b57b13e0d5024fd20e6933d7?network=testnet) |
| Qualify voter at level 1 | [`0x10a0…1e95`](https://explorer.aptoslabs.com/txn/0x10a0c64623b726f66d9164ac00b49c5db13c6095778f61f2765504e86bc11e95?network=testnet) |
| Create election 0 | [`0x9700…56a8`](https://explorer.aptoslabs.com/txn/0x9700e8001070032372e4d302d395e73e8b0ee037d7fbb5ce4cc6fdbb3a8556a8?network=testnet) |
| Cast fractional ballot | [`0xe848…cdca`](https://explorer.aptoslabs.com/txn/0xe84824da078b9742c03a17ff20551c7d08a688baa294746ebd24f63e0468cdca?network=testnet) |
| Replace ballot with 100% yes | [`0x764a…c33d`](https://explorer.aptoslabs.com/txn/0x764adf429ff35456879859a18a4966200b998a0c9e1dbeeb54ea65ec2fffc33d?network=testnet) |
| Cast creator ballot | [`0x28a2…1003`](https://explorer.aptoslabs.com/txn/0x28a25dcd2259690a0efe7cbb22bd43270ca27dbb81ca2cb62db29bffbc7a1003?network=testnet) |
| Add second administrator | [`0xf1fd…223c`](https://explorer.aptoslabs.com/txn/0xf1fdca618f4a838ce9e3e2febcf30f7000c28e1f9f078fe259ea902860e0223c?network=testnet) |
| Add third administrator | [`0x4fbe…22a`](https://explorer.aptoslabs.com/txn/0x4fbe05bf2a0b882e45b7b1c396cdf7ef5f7ecb533372ae5cac4f40428242e446?network=testnet) |
| Finalize election | [`0xc5c2…f66c`](https://explorer.aptoslabs.com/txn/0xc5c207324a1df3b4848bda0c72ba9f781cac7b9f598b6b07544d7736eedff66c?network=testnet) |
| Propose voter level 1 to 2 | [`0xcd9d…0b69`](https://explorer.aptoslabs.com/txn/0xcd9d3df1d55d853e2762344138feb60e4a6f9f54a46c8acd27ad30c6afe70b69?network=testnet) |
| Approve voter level 2 | [`0x85cb…8838`](https://explorer.aptoslabs.com/txn/0x85cb21f1132c7e432d859e14584ce160a7b7210261961017a3b21b18eee58838?network=testnet) |
| Propose policy update | [`0xfc13…fcab`](https://explorer.aptoslabs.com/txn/0xfc139d51acb7433a02b4328fdce14fd65146569dfa8d9418a0ddb71de4f2fcab?network=testnet) |
| Approve policy update with 2-of-3 council | [`0x0abf…bd05`](https://explorer.aptoslabs.com/txn/0x0abf7d54c2decb6ac2ff428bcdd4a7130a9609c259f1f6ed28e053cd3b3fbd05?network=testnet) |

## Verified final reads

```text
is_initialized() = true
admin_threshold() = 2
admins() = [creator, admin 2, admin 3]
versions() = (council=3, policy=3, membership=3)

current_qualification(voter, category 1) = level 2, eligible true
category_policy(1).quotas_bps = [2500, 1600, 2400, 3500]

election_result(0) = (true, true, true)
election_tallies(0) = (yes=16000000000, no=0, abstain=0, voters=2)
vote_of(0, voter) = active, revision 2, weight 600000, allocation 10000/0/0
vote_revision(0, 0) = archived prior ballot, allocation 2500/5000/2500
```

The election's snapshot had eligible weight `1,600,000`; the configured quorum was 40%, so the quorum threshold was `640,000`. Both eligible voters participated, producing a successful final result.

## What this proves and what it does not

It proves that the public Testnet package executes the core scenario on the Aptos network. It does not make the system a legal voting system, establish identity verification, or replace a security audit before Mainnet.
