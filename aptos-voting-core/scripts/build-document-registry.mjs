import { createHash } from 'node:crypto'
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const coreRoot = path.resolve(scriptDir, '..')
const workspaceRoot = path.resolve(coreRoot, '..')
const sourceRoot = path.join(coreRoot, 'documents', 'source')
const registryRoot = path.join(coreRoot, 'document-registry')
const webPublicRoot = path.join(workspaceRoot, 'novyway', 'public', 'documents')

const schemaVersion = 'sovet-online-document-anchor-v1'
const packageAddress = '0xdd2c843725904c661a3b592e84a6794dbe2076e947b045cdc55b8cd7d4cb0411'
const sourceArchive = {
  fileName: 'Новый Путь-20260714T184622Z-1-001.zip',
  sha256: '0xfd9ca58a3374ccf89c81bdd20f6845d407c538d4962121fe81ad7a874ef2d990',
}

const catalog = [
  {
    id: 'nsbv-charter',
    sourceFile: 'nsbv-charter.docx',
    originalPath: 'Баланс Власти/Устав_НСБВ.docx',
    title: 'Устав Независимого Совета баланса властей',
    kind: 'charter',
    primaryTopic: 'governance',
    secondaryTopics: ['constitutional-design', 'public-institutions'],
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  },
  {
    id: 'draft-law-peoples-militia',
    sourceFile: 'draft-law-peoples-militia.docx',
    originalPath: 'Возможные Гражданские организации/Федеральный_закон_О_Народной_милиции.docx',
    title: 'Проект федерального закона «О Народной милиции»',
    kind: 'draft-law',
    primaryTopic: 'civil-organizations',
    secondaryTopics: ['law', 'public-safety'],
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  },
  {
    id: 'voting-weight-calculator',
    sourceFile: 'voting-weight-calculator.xlsx',
    originalPath: 'Голоса/Калькулятор Весов.xlsx',
    title: 'Калькулятор весов голосов',
    kind: 'calculation-model',
    primaryTopic: 'voting-system',
    secondaryTopics: ['mathematics', 'qualification-weights'],
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  },
  {
    id: 'voting-system-council-charter',
    sourceFile: 'voting-system-council-charter.docx',
    originalPath: 'Голоса/Устав Совета по управлению системой голосов.docx',
    title: 'Устав Совета по управлению системой голосов',
    kind: 'charter',
    primaryTopic: 'voting-system',
    secondaryTopics: ['governance', 'qualifications'],
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  },
  {
    id: 'vote-weight-methodology',
    sourceFile: 'vote-weight-methodology.docx',
    originalPath: 'Голоса/Формирование Голоса Объяснение.docx',
    title: 'Формирование суммы голосов в цифровой меритократической системе',
    kind: 'methodology',
    primaryTopic: 'voting-system',
    secondaryTopics: ['methodology', 'qualification-weights'],
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  },
]

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
  return sha256(output)
}

const entries = []
for (const item of catalog) {
  const sourcePath = path.join(sourceRoot, item.sourceFile)
  const bytes = await readFile(sourcePath)
  const documentKey = sha256(`sovet-online:document:${item.id}`)
  const contentHash = sha256(bytes)
  const publicUrl = `/documents/original/${item.sourceFile}`
  const metadataUrl = `/documents/anchors/${item.id}.json`
  const metadataUri = `sovet-online://documents/anchors/${item.id}.json`
  const metadata = {
    schemaVersion,
    documentId: item.id,
    documentKey,
    version: '2026-07-14',
    title: item.title,
    kind: item.kind,
    primaryTopic: item.primaryTopic,
    secondaryTopics: item.secondaryTopics,
    sourceArchive,
    originalPath: item.originalPath,
    publicUrl,
    mimeType: item.mimeType,
    bytes: bytes.byteLength,
    contentSha256: contentHash,
  }
  const metadataHash = await writeCanonical(path.join(registryRoot, 'anchors', `${item.id}.json`), metadata)
  await writeCanonical(path.join(webPublicRoot, 'anchors', `${item.id}.json`), metadata)
  await mkdir(path.join(webPublicRoot, 'original'), { recursive: true })
  await cp(sourcePath, path.join(webPublicRoot, 'original', item.sourceFile), { force: true })
  entries.push({
    ...metadata,
    metadataUrl,
    metadataUri,
    metadataSha256: metadataHash,
    parentContentSha256: '0x',
    recoveryBundleSha256: '0x',
  })
}

const manifest = {
  schemaVersion,
  registryGeneration: 1,
  network: 'aptos-testnet',
  packageAddress,
  sourceArchive,
  documents: entries,
}

const manifestHash = await writeCanonical(path.join(registryRoot, 'manifest.v1.json'), manifest)
await writeCanonical(path.join(webPublicRoot, 'manifest.v1.json'), manifest)
await writeFile(path.join(registryRoot, 'manifest.v1.sha256'), `${manifestHash}\n`, 'utf8')

const publishPlan = {
  schemaVersion,
  packageAddress,
  module: 'document_anchor',
  manifestSha256: manifestHash,
  documents: entries.map((entry) => ({
    documentId: entry.documentId,
    documentKey: entry.documentKey,
    contentHash: entry.contentSha256,
    parentContentHash: entry.parentContentSha256,
    metadataHash: entry.metadataSha256,
    recoveryBundleHash: entry.recoveryBundleSha256,
    contentBytes: entry.bytes,
    mimeType: entry.mimeType,
    metadataUri: entry.metadataUri,
    version: entry.version,
  })),
}
await writeCanonical(path.join(registryRoot, 'publish-plan.v1.json'), publishPlan)
console.log(JSON.stringify({ manifestHash, documents: entries.length, registryRoot, webPublicRoot }, null, 2))
