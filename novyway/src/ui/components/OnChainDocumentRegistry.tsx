import { useCallback, useEffect, useState } from 'react'
import { aptosTestnetExplorer, createDocumentAnchorGateway } from '../../adapters/aptos/documentAnchorGateway'
import { configuredVotingModule } from '../../adapters/aptos/aptosReadGateway'
import type { DocumentAnchorRecord, HexHash } from '../../adapters/types'
import { useT } from '../../i18n'
import { Panel } from './index'

type VerificationState = 'loading' | 'verified' | 'metadata-mismatch' | 'content-mismatch' | 'unavailable'

interface DocumentMetadata {
  documentId: string
  title: string
  kind: string
  primaryTopic: string
  secondaryTopics: string[]
  publicUrl: string
  contentSha256: HexHash
  bytes: number
  mimeType: string
}

interface RegistryDocument {
  anchor: DocumentAnchorRecord
  metadata?: DocumentMetadata
  state: VerificationState
  detail?: string
}

const gateway = createDocumentAnchorGateway()
const packageAddress = configuredVotingModule()

const documentTransactions: Record<string, string> = {
  'nsbv-charter': '0x9cc0680c273e8ddc4fba87c7b73027f2e1dbd76544d1230b5d006cb3dc1e1d62',
  'draft-law-peoples-militia': '0x8a8c1237e157818c17217178e75a5d90b86f7ac5a6c7fa4d772fe8dbdcdbadd6',
  'voting-weight-calculator': '0x4600bfbeca78a01e81a9541e801694212062893361662ecc387199ca6fe231d1',
  'voting-system-council-charter': '0xa67a387678072fbeb1032cf0569665ec0fb6822e2033123034466d16d3c1f38d',
  'vote-weight-methodology': '0xdf1f33c0d2f5667c0ef451f3cec98df998c3419ee568dfbd717f3768e0486771',
  'testnet-generation-1-proof': '0x75db6dfc959079dbd90e0bbe262aeb9c984f0a6997bc624ea2f94615f53236fe',
}

const topicLabels: Record<string, { ru: string; en: string }> = {
  governance: { ru: 'управление', en: 'governance' },
  'constitutional-design': { ru: 'конституционное устройство', en: 'constitutional design' },
  'public-institutions': { ru: 'общественные институты', en: 'public institutions' },
  'civil-organizations': { ru: 'гражданские организации', en: 'civil organizations' },
  law: { ru: 'право', en: 'law' },
  'public-safety': { ru: 'общественная безопасность', en: 'public safety' },
  'voting-system': { ru: 'система голосования', en: 'voting system' },
  mathematics: { ru: 'математика', en: 'mathematics' },
  'qualification-weights': { ru: 'веса квалификации', en: 'qualification weights' },
  qualifications: { ru: 'квалификации', en: 'qualifications' },
  methodology: { ru: 'методика', en: 'methodology' },
  testnet: { ru: 'тестовая сеть', en: 'testnet' },
  recovery: { ru: 'восстановление', en: 'recovery' },
  'document-registry': { ru: 'реестр документов', en: 'document registry' },
}

const documentTitles: Record<string, { ru: string; en: string }> = {
  'draft-law-peoples-militia': { ru: 'Проект федерального закона «О Народной милиции»', en: 'Draft Federal Law on the People’s Militia' },
  'nsbv-charter': { ru: 'Устав Независимого Совета баланса властей', en: 'Charter of the Independent Council for the Balance of Powers' },
  'testnet-generation-1-proof': { ru: 'Aptos Testnet: доказательный пакет поколения 1', en: 'Aptos Testnet: Generation 1 Evidence Bundle' },
  'vote-weight-methodology': { ru: 'Формирование суммы голосов в цифровой меритократической системе', en: 'Vote Aggregation in a Digital Meritocratic System' },
  'voting-system-council-charter': { ru: 'Устав Совета по управлению системой голосов', en: 'Charter of the Voting System Council' },
  'voting-weight-calculator': { ru: 'Калькулятор весов голосов', en: 'Voting Weight Calculator' },
}

function localizedTopic(topic: string, lang: 'ru' | 'en') {
  return topicLabels[topic]?.[lang] ?? topic.replaceAll('-', ' ')
}

function assetUrl(uri: string) {
  const localPath = uri.startsWith('sovet-online://') ? uri.slice('sovet-online://'.length) : uri.replace(/^\//, '')
  if (/^https?:\/\//.test(uri)) return uri
  return `${import.meta.env.BASE_URL}${localPath.replace(/^\//, '')}`
}

async function sha256Hex(input: string | ArrayBuffer): Promise<HexHash> {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return `0x${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')}` as HexHash
}

function isMetadata(value: unknown): value is DocumentMetadata {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<DocumentMetadata>
  return typeof candidate.documentId === 'string'
    && typeof candidate.title === 'string'
    && typeof candidate.kind === 'string'
    && typeof candidate.primaryTopic === 'string'
    && Array.isArray(candidate.secondaryTopics)
    && typeof candidate.publicUrl === 'string'
    && typeof candidate.contentSha256 === 'string'
    && typeof candidate.bytes === 'number'
    && typeof candidate.mimeType === 'string'
}

async function verifyAnchor(anchor: DocumentAnchorRecord): Promise<RegistryDocument> {
  try {
    const metadataResponse = await fetch(assetUrl(anchor.metadataUri), { cache: 'no-store' })
    if (!metadataResponse.ok) return { anchor, state: 'unavailable', detail: `metadata HTTP ${metadataResponse.status}` }
    const metadataText = await metadataResponse.text()
    if (await sha256Hex(metadataText) !== anchor.metadataHash) return { anchor, state: 'metadata-mismatch' }
    const metadataJson: unknown = JSON.parse(metadataText)
    if (!isMetadata(metadataJson)) return { anchor, state: 'unavailable', detail: 'invalid metadata schema' }
    const contentResponse = await fetch(assetUrl(metadataJson.publicUrl), { cache: 'no-store' })
    if (!contentResponse.ok) return { anchor, metadata: metadataJson, state: 'unavailable', detail: `file HTTP ${contentResponse.status}` }
    const content = await contentResponse.arrayBuffer()
    const contentHash = await sha256Hex(content)
    const consistent = contentHash === anchor.contentHash
      && contentHash === metadataJson.contentSha256
      && content.byteLength === Number(anchor.contentBytes)
      && content.byteLength === metadataJson.bytes
      && metadataJson.mimeType === anchor.mimeType
    return { anchor, metadata: metadataJson, state: consistent ? 'verified' : 'content-mismatch' }
  } catch (error) {
    return { anchor, state: 'unavailable', detail: error instanceof Error ? error.message : 'verification failed' }
  }
}

async function loadRegistry() {
  const count = Number(await gateway.anchorCount())
  if (!Number.isSafeInteger(count) || count < 0 || count > 1000) throw new Error('Invalid document registry count')
  const anchors = await Promise.all(Array.from({ length: count }, (_, index) => gateway.anchor(String(index))))
  return Promise.all(anchors.map(verifyAnchor))
}

function verificationLabel(state: VerificationState, ru: boolean) {
  const labels: Record<VerificationState, [string, string]> = {
    loading: ['Проверка', 'Checking'],
    verified: ['Проверено', 'Verified'],
    'metadata-mismatch': ['Метаданные не совпали', 'Metadata mismatch'],
    'content-mismatch': ['Файл не совпал', 'File mismatch'],
    unavailable: ['Недоступно', 'Unavailable'],
  }
  return labels[state][ru ? 0 : 1]
}

export function OnChainDocumentRegistry() {
  const { lang } = useT()
  const ru = lang === 'ru'
  const [documents, setDocuments] = useState<RegistryDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(() => {
    setLoading(true)
    setError(null)
    loadRegistry()
      .then((records) => setDocuments(records))
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Network node unavailable'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const verifiedCount = documents.filter((document) => document.state === 'verified').length
  return (
    <Panel
      className="chain-registry"
      title={ru ? 'Проверяемый архив тестовой сети' : 'Verifiable Testnet archive'}
      hint={ru ? 'Aptos · SHA-256' : 'Aptos · SHA-256'}
    >
      <div className="chain-registry-head">
        <p className="muted">
          {ru
            ? 'Публичные записи тестовой сети: сайт сверяет хэши метаданных и исходных файлов прямо в браузере.'
            : 'Public Testnet records: this page checks metadata and source-file hashes directly in the browser.'}
        </p>
        <button className="btn small" type="button" onClick={refresh} disabled={loading}>
          {loading ? (ru ? 'Проверяем...' : 'Checking...') : (ru ? 'Обновить' : 'Refresh')}
        </button>
      </div>

      {error && <div className="callout red chain-registry-error">{ru ? 'Узел Aptos недоступен: ' : 'Aptos node unavailable: '}{error}</div>}
      {!error && !loading && (
        <div className="chain-registry-summary mono">
          {verifiedCount}/{documents.length} {ru ? 'файлов совпадают с записями в сети' : 'files match their on-chain records'}
          <a href={aptosTestnetExplorer(`account/${packageAddress}/modules`)} target="_blank" rel="noreferrer">
            {ru ? ' Открыть модуль в обозревателе' : ' Open module in Explorer'}
          </a>
        </div>
      )}

      <div className="chain-registry-list" aria-live="polite">
        {documents.map((document) => {
          const date = new Date(Number(document.anchor.anchoredAtSecs) * 1000).toLocaleString(ru ? 'ru-RU' : 'en-GB')
          const title = document.metadata
            ? documentTitles[document.metadata.documentId]?.[lang] ?? (ru ? document.metadata.title : document.metadata.documentId.replaceAll('-', ' '))
            : `${ru ? 'Запись' : 'Record'} #${document.anchor.anchorId}`
          const fileUrl = document.metadata ? assetUrl(document.metadata.publicUrl) : undefined
          const transactionHash = document.metadata ? documentTransactions[document.metadata.documentId] : undefined
          return (
            <article className="chain-document" key={document.anchor.anchorId}>
              <div className="row between" style={{ gap: 8 }}>
                <div>
                  <div className="chain-document-title">{title}</div>
                  <div className="muted mono">{ru ? 'версия' : 'version'} {document.anchor.revision} · {date}</div>
                </div>
                <span className={`chip ${document.state === 'verified' ? 'ok' : document.state === 'loading' ? 'warn' : 'crit'}`}>
                  <span className="dot" /> {verificationLabel(document.state, ru)}
                </span>
              </div>
              {document.metadata && (
                <div className="topic-row" aria-label={ru ? 'Классификация' : 'Classification'}>
                  <span className="chip">{localizedTopic(document.metadata.primaryTopic, lang)}</span>
                  {document.metadata.secondaryTopics.map((topic) => <span className="chip mute" key={topic}>+ {localizedTopic(topic, lang)}</span>)}
                </div>
              )}
              <div className="chain-document-hash mono" title={document.anchor.contentHash}>
                SHA-256 {document.anchor.contentHash.slice(0, 18)}…{document.anchor.contentHash.slice(-10)} · {document.anchor.contentBytes} {ru ? 'байт' : 'bytes'}
              </div>
              <div className="row chain-document-actions">
                {fileUrl && <a className="btn small" href={fileUrl} target="_blank" rel="noreferrer">{ru ? 'Открыть исходник' : 'Open source'}</a>}
                {transactionHash && <a className="muted inline-link" href={aptosTestnetExplorer(`txn/${transactionHash}`)} target="_blank" rel="noreferrer">
                  {ru ? 'Транзакция в обозревателе' : 'Transaction in Explorer'}
                </a>}
                {document.detail && <span className="muted">{document.detail}</span>}
              </div>
            </article>
          )
        })}
      </div>
      <div className="chain-registry-note">
        {ru
          ? 'Это демонстрационный реестр Aptos Testnet. Он подтверждает, что опубликованный аккаунт зафиксировал конкретные байты файла, но не доказывает авторство, юридическую силу или бессрочное хранение.'
          : 'This Aptos Testnet demo proves that the published account anchored specific file bytes. It does not prove authorship, legal validity, or permanent storage.'}
      </div>
    </Panel>
  )
}
