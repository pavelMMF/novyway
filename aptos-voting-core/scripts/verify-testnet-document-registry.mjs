import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const registryRoot = path.resolve(scriptDir, '..', 'document-registry')
const rpcUrl = process.env.APTOS_TESTNET_RPC_URL || 'https://fullnode.testnet.aptoslabs.com/v1'

const mainPlan = JSON.parse(await readFile(path.join(registryRoot, 'publish-plan.v1.json'), 'utf8'))
const proofPlan = JSON.parse(await readFile(path.join(registryRoot, 'testnet-generation-1-proof.publish-plan.json'), 'utf8'))
const expected = [...mainPlan.documents, ...proofPlan.documents]
const packageAddress = mainPlan.packageAddress

function bytesToText(value) {
  if (value === '0x') return ''
  return Buffer.from(value.slice(2), 'hex').toString('utf8')
}

async function view(functionName, args = []) {
  const response = await fetch(`${rpcUrl}/view`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      function: `${packageAddress}::document_anchor::${functionName}`,
      type_arguments: [],
      arguments: args,
    }),
  })
  if (!response.ok) throw new Error(`Aptos RPC ${response.status}: ${await response.text()}`)
  return response.json()
}

function assertEqual(label, actual, wanted) {
  if (String(actual).toLowerCase() !== String(wanted).toLowerCase()) {
    throw new Error(`${label}: expected ${wanted}, received ${actual}`)
  }
}

const count = await view('anchor_count')
assertEqual('anchor count', count[0], expected.length)

for (const [anchorId, item] of expected.entries()) {
  const result = await view('anchor', [String(anchorId)])
  if (!Array.isArray(result) || result.length !== 12) throw new Error(`anchor ${anchorId}: invalid response`)

  assertEqual(`anchor ${anchorId} document key`, result[0], item.documentKey)
  assertEqual(`anchor ${anchorId} revision`, result[1], 1)
  assertEqual(`anchor ${anchorId} content hash`, result[2], item.contentHash)
  assertEqual(`anchor ${anchorId} parent hash`, result[3], item.parentContentHash)
  assertEqual(`anchor ${anchorId} metadata hash`, result[4], item.metadataHash)
  assertEqual(`anchor ${anchorId} recovery hash`, result[5], item.recoveryBundleHash)
  assertEqual(`anchor ${anchorId} byte count`, result[6], item.contentBytes)
  assertEqual(`anchor ${anchorId} MIME type`, bytesToText(result[7]), item.mimeType)
  assertEqual(`anchor ${anchorId} metadata URI`, bytesToText(result[8]), item.metadataUri)
  assertEqual(`anchor ${anchorId} version`, bytesToText(result[9]), item.version)
  assertEqual(`anchor ${anchorId} administrator`, result[10], packageAddress)

  console.log(`ok ${anchorId}: ${item.documentId} ${item.contentHash}`)
}

console.log(`verified ${expected.length}/${expected.length} Aptos Testnet document anchors at ${packageAddress}`)
