import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto'
import { createReadStream, createWriteStream, openSync, closeSync, readSync, statSync } from 'node:fs'
import { pipeline } from 'node:stream/promises'

const MAGIC = Buffer.from('SOVETREC1')
const HEADER_BYTES = MAGIC.length + 16 + 12
const TAG_BYTES = 16

const [mode, input, output] = process.argv.slice(2)
const passphrase = process.env.SOVET_RECOVERY_PASSPHRASE
delete process.env.SOVET_RECOVERY_PASSPHRASE

if (!['encrypt', 'decrypt'].includes(mode) || !input || !output || !passphrase || passphrase.length < 16) {
  console.error('Usage: recovery-crypto.mjs encrypt|decrypt <input> <output>; passphrase must be supplied via SOVET_RECOVERY_PASSPHRASE and contain at least 16 characters.')
  process.exit(2)
}

if (mode === 'encrypt') {
  const salt = randomBytes(16)
  const iv = randomBytes(12)
  const key = scryptSync(passphrase, salt, 32, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 })
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const sink = createWriteStream(output, { flags: 'w' })
  sink.write(Buffer.concat([MAGIC, salt, iv]))
  await pipeline(createReadStream(input), cipher, sink)
  const tagSink = createWriteStream(output, { flags: 'a' })
  tagSink.end(cipher.getAuthTag())
  await new Promise((resolve, reject) => tagSink.on('close', resolve).on('error', reject))
} else {
  const size = statSync(input).size
  if (size <= HEADER_BYTES + TAG_BYTES) throw new Error('recovery_bundle_too_short')
  const descriptor = openSync(input, 'r')
  const header = Buffer.alloc(HEADER_BYTES)
  const tag = Buffer.alloc(TAG_BYTES)
  try {
    readSync(descriptor, header, 0, header.length, 0)
    readSync(descriptor, tag, 0, tag.length, size - TAG_BYTES)
  } finally {
    closeSync(descriptor)
  }
  if (!header.subarray(0, MAGIC.length).equals(MAGIC)) throw new Error('recovery_bundle_format_invalid')
  const salt = header.subarray(MAGIC.length, MAGIC.length + 16)
  const iv = header.subarray(MAGIC.length + 16, HEADER_BYTES)
  const key = scryptSync(passphrase, salt, 32, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 })
  const decipher = createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)
  await pipeline(createReadStream(input, { start: HEADER_BYTES, end: size - TAG_BYTES - 1 }), decipher, createWriteStream(output, { flags: 'wx' }))
}
