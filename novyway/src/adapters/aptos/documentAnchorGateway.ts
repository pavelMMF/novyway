import type { ChainU64, DocumentAnchorGateway, DocumentAnchorRecord, HexHash } from '../types'

const DEFAULT_TESTNET_MODULE = '0xdd2c843725904c661a3b592e84a6794dbe2076e947b045cdc55b8cd7d4cb0411'
const TESTNET_RPC = 'https://fullnode.testnet.aptoslabs.com/v1'

function configuredModuleAddress() {
  return (import.meta.env.VITE_APTOS_MODULE_ADDRESS as string | undefined) || DEFAULT_TESTNET_MODULE
}

function configuredRpcUrl() {
  const network = import.meta.env.VITE_APTOS_NETWORK as string | undefined
  if (network && network !== 'testnet') return ''
  return TESTNET_RPC
}

function asHex(value: unknown): HexHash | '0x' {
  if (typeof value !== 'string' || !/^0x[0-9a-f]*$/i.test(value)) throw new Error('Aptos returned an invalid byte vector')
  return value.toLowerCase() as HexHash | '0x'
}

function asText(value: unknown) {
  const hex = asHex(value)
  if (hex === '0x') return ''
  const pairs = hex.slice(2).match(/.{1,2}/g) ?? []
  return new TextDecoder().decode(new Uint8Array(pairs.map((pair) => Number.parseInt(pair, 16))))
}

async function view(moduleAddress: string, rpcUrl: string, functionName: string, args: unknown[] = []) {
  const response = await fetch(`${rpcUrl}/view`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ function: `${moduleAddress}::document_anchor::${functionName}`, type_arguments: [], arguments: args }),
  })
  if (!response.ok) throw new Error(`Aptos RPC ${response.status}`)
  const result: unknown = await response.json()
  if (!Array.isArray(result)) throw new Error('Aptos RPC returned an invalid view response')
  return result
}

function readAnchor(anchorId: ChainU64, raw: unknown[]): DocumentAnchorRecord {
  if (raw.length !== 12) throw new Error('Aptos returned an invalid document anchor')
  const [documentKey, revision, contentHash, parentContentHash, metadataHash, recoveryBundleHash, contentBytes, mimeType, metadataUri, version, anchoredBy, anchoredAtSecs] = raw
  if (typeof revision !== 'string' || typeof contentBytes !== 'string' || typeof anchoredBy !== 'string' || typeof anchoredAtSecs !== 'string') {
    throw new Error('Aptos returned an invalid document anchor scalar')
  }
  return {
    anchorId,
    documentKey: asHex(documentKey) as HexHash,
    revision,
    contentHash: asHex(contentHash) as HexHash,
    parentContentHash: asHex(parentContentHash),
    metadataHash: asHex(metadataHash) as HexHash,
    recoveryBundleHash: asHex(recoveryBundleHash),
    contentBytes,
    mimeType: asText(mimeType),
    metadataUri: asText(metadataUri),
    version: asText(version),
    anchoredBy,
    anchoredAtSecs,
  }
}

export function createDocumentAnchorGateway(): DocumentAnchorGateway {
  const moduleAddress = configuredModuleAddress()
  const rpcUrl = configuredRpcUrl()
  return {
    isConfigured: () => Boolean(moduleAddress && rpcUrl),
    async anchorCount() {
      const result = await view(moduleAddress, rpcUrl, 'anchor_count')
      if (typeof result[0] !== 'string') throw new Error('Aptos returned an invalid anchor count')
      return result[0]
    },
    async anchor(anchorId) {
      return readAnchor(anchorId, await view(moduleAddress, rpcUrl, 'anchor', [anchorId]))
    },
  }
}

export const aptosTestnetExplorer = (path: string) => `https://explorer.aptoslabs.com/${path}?network=testnet`
