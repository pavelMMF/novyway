import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const coreRoot = path.resolve(scriptDir, '..')
const workspaceRoot = path.resolve(coreRoot, '..')
const registryRoot = path.join(coreRoot, 'document-registry')
const webDocumentsRoot = path.join(workspaceRoot, 'novyway', 'public', 'documents')

const generation = 1
const proofId = `testnet-generation-${generation}-proof`
const packageAddress = '0xdd2c843725904c661a3b592e84a6794dbe2076e947b045cdc55b8cd7d4cb0411'
const anchorTransactions = {
  packageUpgrade: '0x315b1d6a1a21169dff1e352404a9af1fe11d8dc5144a09e97b2c5eaf619bf161',
  registryInitialize: '0x60b80aadb8b54ae309bf5474411e877b4e7ca5b5d97b6be05ab0234a61c8425b',
  documents: {
    'nsbv-charter': '0x9cc0680c273e8ddc4fba87c7b73027f2e1dbd76544d1230b5d006cb3dc1e1d62',
    'draft-law-peoples-militia': '0x8a8c1237e157818c17217178e75a5d90b86f7ac5a6c7fa4d772fe8dbdcdbadd6',
    'voting-weight-calculator': '0x4600bfbeca78a01e81a9541e801694212062893361662ecc387199ca6fe231d1',
    'voting-system-council-charter': '0xa67a387678072fbeb1032cf0569665ec0fb6822e2033123034466d16d3c1f38d',
    'vote-weight-methodology': '0xdf1f33c0d2f5667c0ef451f3cec98df998c3419ee568dfbd717f3768e0486771',
  },
}

function sha256(bytes) {
  return `0x${createHash('sha256').update(bytes).digest('hex')}`
}

function canonicalJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`
}

async function writeCanonical(filePath, value) {
  const output = canonicalJson(value)
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, output, 'utf8')
  return { bytes: Buffer.byteLength(output), sha256: sha256(output) }
}

const publishPlanPath = path.join(registryRoot, 'publish-plan.v1.json')
const manifestPath = path.join(registryRoot, 'manifest.v1.json')
const publishPlan = JSON.parse(await readFile(publishPlanPath, 'utf8'))
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))

const operations = publishPlan.documents.map((document, index) => ({
  idempotencyKey: `generation-${generation}:document:${document.documentId}:revision:1`,
  operation: 'anchor_document',
  documentId: document.documentId,
  anchorId: index,
  transactionHash: anchorTransactions.documents[document.documentId],
  documentKey: document.documentKey,
  contentHash: document.contentHash,
  metadataHash: document.metadataHash,
}))

const proof = {
  schemaVersion: 'sovet-online-testnet-proof-v1',
  generatedAt: '2026-07-14T00:00:00.000Z',
  generation,
  network: 'aptos-testnet',
  packageAddress,
  claims: {
    verified: 'The listed bytes and canonical metadata were anchored by the package administrator on resettable Aptos Testnet.',
    notVerified: 'This record does not prove authorship, legal force, permanent file availability, or that Aptos Testnet will retain the generation forever.',
  },
  sourceArchive: manifest.sourceArchive,
  manifest: {
    file: 'document-registry/manifest.v1.json',
    sha256: publishPlan.manifestSha256,
  },
  transactions: anchorTransactions,
  operations,
  recovery: {
    replayRawSignedTransactions: false,
    method: 'Deploy a fresh compatible package, initialize the registry, then replay logical anchor_document operations with this proof SHA-256 as recoveryBundleHash.',
    recoveryBundleHashAfterPublication: 'The on-chain anchor for this proof is intentionally outside this file to avoid a self-referential hash. Its transaction is recorded in TESTNET_DOCUMENT_REGISTRY.md.',
  },
}

const proofRegistryPath = path.join(registryRoot, 'proofs', `${proofId}.json`)
const proofWebPath = path.join(webDocumentsRoot, 'proofs', `${proofId}.json`)
const proofResult = await writeCanonical(proofRegistryPath, proof)
await writeCanonical(proofWebPath, proof)

const documentKey = sha256(`sovet-online:document:${proofId}`)
const metadata = {
  schemaVersion: 'sovet-online-document-anchor-v1',
  documentId: proofId,
  documentKey,
  version: '2026-07-14',
  title: 'Aptos Testnet: доказательный пакет поколения 1',
  kind: 'audit-log',
  primaryTopic: 'governance',
  secondaryTopics: ['testnet', 'recovery', 'document-registry'],
  originalPath: `document-registry/proofs/${proofId}.json`,
  publicUrl: `/documents/proofs/${proofId}.json`,
  mimeType: 'application/json',
  bytes: proofResult.bytes,
  contentSha256: proofResult.sha256,
}
const metadataRegistryPath = path.join(registryRoot, 'anchors', `${proofId}.json`)
const metadataWebPath = path.join(webDocumentsRoot, 'anchors', `${proofId}.json`)
const metadataResult = await writeCanonical(metadataRegistryPath, metadata)
await writeCanonical(metadataWebPath, metadata)

const proofPlan = {
  schemaVersion: 'sovet-online-document-anchor-v1',
  packageAddress,
  module: 'document_anchor',
  manifestSha256: publishPlan.manifestSha256,
  documents: [{
    documentId: proofId,
    documentKey,
    contentHash: proofResult.sha256,
    parentContentHash: '0x',
    metadataHash: metadataResult.sha256,
    recoveryBundleHash: '0x',
    contentBytes: proofResult.bytes,
    mimeType: 'application/json',
    metadataUri: `sovet-online://documents/anchors/${proofId}.json`,
    version: '2026-07-14',
  }],
}
const proofPlanPath = path.join(registryRoot, `${proofId}.publish-plan.json`)
await writeCanonical(proofPlanPath, proofPlan)

await writeFile(path.join(registryRoot, 'operations.v1.jsonl'), `${operations.map((operation) => JSON.stringify(operation)).join('\n')}\n`, 'utf8')
console.log(JSON.stringify({ proofId, proofHash: proofResult.sha256, proofBytes: proofResult.bytes, proofPlanPath }, null, 2))
