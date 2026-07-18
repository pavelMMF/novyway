import { createHash } from 'node:crypto'

export const DOCUMENT_PROPOSAL_SCHEMA = 'novyway.document-amendment.v1'

const nfc = (value) => String(value).normalize('NFC')

export function canonicalJson(value) {
  if (value === null) return 'null'
  if (typeof value === 'string') return JSON.stringify(nfc(value))
  if (typeof value === 'boolean') return JSON.stringify(value)
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('canonical_json_non_finite_number')
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (typeof value === 'object') {
    const prototype = Object.getPrototypeOf(value)
    if (prototype !== Object.prototype && prototype !== null) throw new TypeError('canonical_json_invalid_object')
    const entries = Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
    return `{${entries.join(',')}}`
  }
  throw new TypeError('canonical_json_unsupported_value')
}

export function proposalSha256(payload) {
  return `0x${createHash('sha256').update(canonicalJson(payload), 'utf8').digest('hex')}`
}

export function createProposalPayload(input, { id, createdAt, createdByAddress }) {
  return {
    schema: DOCUMENT_PROPOSAL_SCHEMA,
    id,
    createdAt,
    createdBy: nfc(createdByAddress).toLowerCase(),
    document: {
      id: nfc(input.documentId),
      title: { ru: nfc(input.documentTitleRu), en: nfc(input.documentTitleEn) },
      baseVersion: nfc(input.baseVersion),
      baseDocumentHash: input.baseDocumentHash.toLowerCase(),
    },
    clause: {
      id: nfc(input.clauseId),
      number: nfc(input.clauseNumber),
      title: { ru: nfc(input.clauseTitleRu), en: nfc(input.clauseTitleEn) },
      currentText: { ru: nfc(input.currentTextRu), en: nfc(input.currentTextEn) },
    },
    amendment: {
      kind: nfc(input.kind),
      proposedText: { ru: nfc(input.proposedTextRu), en: nfc(input.proposedTextEn) },
      rationale: { ru: nfc(input.rationaleRu), en: nfc(input.rationaleEn) },
    },
    voting: {
      categoryId: nfc(input.categoryId),
      startsAtSecs: '0',
      endsAtSecs: nfc(input.endsAtSecs),
      passBps: Number(input.passBps),
      quorumBps: Number(input.quorumBps),
      allowRevote: input.allowRevote,
    },
  }
}

export function publicProposal(row) {
  return {
    id: row.id,
    documentId: row.document_id,
    clauseId: row.clause_id,
    categoryId: String(row.category_id),
    canonicalText: row.canonical_text,
    payload: row.payload_json,
    metadataHash: row.metadata_hash,
    metadataUri: row.metadata_uri,
    status: row.status,
    chainId: row.chain_id,
    moduleAddress: row.module_address,
    deploymentGeneration: row.deployment_generation,
    electionId: row.election_id === null ? null : String(row.election_id),
    creationTxHash: row.creation_tx_hash,
    finalizationTxHash: row.finalization_tx_hash,
    createdAt: row.created_at,
    publishedAt: row.published_at,
  }
}
