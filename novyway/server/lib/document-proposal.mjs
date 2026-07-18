import { createHash } from 'node:crypto'

export const DOCUMENT_PROPOSAL_SCHEMA = 'novyway.document-amendment.v2'
export const DOCUMENT_SUPPORT_SCHEMA = 'novyway.proposal-support.v1'

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

export function canonicalSha256(payload) {
  return `0x${createHash('sha256').update(canonicalJson(payload), 'utf8').digest('hex')}`
}

export const proposalSha256 = canonicalSha256

export function createSupportProof({ proposalId, snapshotAt, eligibleAccounts, quorumBps, requiredSupporters, sealedAt, supporters }) {
  return {
    schema: DOCUMENT_SUPPORT_SCHEMA,
    proposalId: nfc(proposalId),
    snapshotAt: nfc(snapshotAt),
    eligibleAccounts: Number(eligibleAccounts),
    quorumBps: Number(quorumBps),
    requiredSupporters: Number(requiredSupporters),
    sealedAt: nfc(sealedAt),
    supporters: supporters
      .map((supporter) => ({
        address: nfc(supporter.address).toLowerCase(),
        supportedAt: new Date(supporter.supportedAt).toISOString(),
      }))
      .sort((left, right) => left.address.localeCompare(right.address) || left.supportedAt.localeCompare(right.supportedAt)),
  }
}

export function createProposalPayload(input, { id, createdAt, createdByAddress, launch }) {
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
      endsAtSecs: '0',
      durationDays: Number(input.durationDays),
      passBps: Number(input.passBps),
      quorumBps: Number(input.quorumBps),
      allowRevote: input.allowRevote,
    },
    launch: {
      rule: 'registered_accounts',
      snapshotAt: nfc(launch.snapshotAt),
      eligibleAccounts: Number(launch.eligibleAccounts),
      quorumBps: Number(launch.quorumBps),
      requiredSupporters: Number(launch.requiredSupporters),
      supportDeadlineAt: nfc(launch.supportDeadlineAt),
      supportersSha256: null,
      sealedAt: null,
    },
  }
}

export function sealProposalSupport(payload, proof) {
  if (payload.schema !== DOCUMENT_PROPOSAL_SCHEMA || proof.schema !== DOCUMENT_SUPPORT_SCHEMA) {
    throw new TypeError('proposal_support_schema_mismatch')
  }
  if (payload.id !== proof.proposalId
    || payload.launch.snapshotAt !== proof.snapshotAt
    || payload.launch.eligibleAccounts !== proof.eligibleAccounts
    || payload.launch.quorumBps !== proof.quorumBps
    || payload.launch.requiredSupporters !== proof.requiredSupporters) {
    throw new TypeError('proposal_support_proof_mismatch')
  }
  return {
    ...payload,
    launch: {
      ...payload.launch,
      supportersSha256: canonicalSha256(proof),
      sealedAt: proof.sealedAt,
    },
  }
}

export function prepareProposalElectionPayload(payload, endsAtSecs) {
  if (payload.schema !== DOCUMENT_PROPOSAL_SCHEMA || !payload.launch?.supportersSha256) {
    throw new TypeError('proposal_support_not_sealed')
  }
  return {
    ...payload,
    voting: {
      ...payload.voting,
      endsAtSecs: nfc(endsAtSecs),
    },
  }
}

function effectiveStatus(row) {
  if (row.status === 'supporting' && row.support_deadline_at && new Date(row.support_deadline_at).getTime() <= Date.now()) return 'expired'
  return row.status
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
    status: effectiveStatus(row),
    chainId: row.chain_id,
    moduleAddress: row.module_address,
    deploymentGeneration: row.deployment_generation,
    electionId: row.election_id === null ? null : String(row.election_id),
    creationTxHash: row.creation_tx_hash,
    finalizationTxHash: row.finalization_tx_hash,
    createdAt: row.created_at,
    publishedAt: row.published_at,
    creator: {
      displayName: row.created_by_name ?? null,
      aptosAddress: row.created_by_address ?? row.payload_json?.createdBy ?? null,
    },
    support: row.support_required_count === null ? null : {
      snapshotAt: row.support_snapshot_at,
      eligibleAccounts: Number(row.support_eligible_count),
      quorumBps: Number(row.support_quorum_bps),
      requiredSupporters: Number(row.support_required_count),
      supporterCount: Number(row.support_count ?? 0),
      deadlineAt: row.support_deadline_at,
      sealedAt: row.support_sealed_at,
      supportersSha256: row.supporters_hash,
      currentUserSupported: Boolean(row.current_user_supported),
    },
  }
}
