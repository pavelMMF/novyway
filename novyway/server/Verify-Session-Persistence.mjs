import { randomBytes } from 'node:crypto'
import { request as httpRequest } from 'node:http'
import { closeStorage, createSession, deleteSession, listGovernanceUsers } from './lib/storage.mjs'
import { csrfCookie, sessionCookie } from './lib/http.mjs'

const host = process.env.SOVET_VERIFY_HOST ?? '127.0.0.1'
const port = Number(process.env.SOVET_VERIFY_PORT ?? 4176)
const users = await listGovernanceUsers()
if (users.length === 0) throw new Error('Session verification requires one active user')

const token = randomBytes(32).toString('base64url')
const signedToken = randomBytes(32).toString('base64url')
const csrfToken = randomBytes(24).toString('base64url')
const signedCsrfToken = randomBytes(24).toString('base64url')
const expiresAt = new Date(Date.now() + 60_000).toISOString()
await createSession({ userId: users[0].id, token, csrfToken, expiresAt, authMethod: 'password' })
await createSession({
  userId: users[0].id,
  token: signedToken,
  csrfToken: signedCsrfToken,
  expiresAt,
  authMethod: 'aptos_signature',
  authAddress: users[0].aptos_address,
})

async function request(path, headers = {}) {
  return new Promise((resolve, reject) => {
    const outgoing = httpRequest({ host, port, path, method: 'GET', headers }, (response) => {
      const chunks = []
      response.on('data', (chunk) => chunks.push(chunk))
      response.on('end', () => resolve({
        status: response.statusCode ?? 0,
        headers: response.headers,
        body: Buffer.concat(chunks).toString('utf8'),
      }))
    })
    outgoing.on('error', reject)
    outgoing.end()
  })
}

try {
  const cookie = sessionCookie(token, 60, true)
  const csrf = csrfCookie(csrfToken, 60, true)
  if (!cookie.includes('HttpOnly') || !cookie.includes('Secure') || !cookie.includes('SameSite=Lax') || !cookie.includes('Max-Age=60') || cookie.includes('Domain=')) {
    throw new Error('Persistent session cookie attributes are unsafe or incomplete')
  }
  if (!csrf.includes('Secure') || !csrf.includes('SameSite=Strict') || !csrf.includes('Max-Age=60')) {
    throw new Error('Persistent CSRF cookie attributes are unsafe or incomplete')
  }

  const authenticated = await request('/api/me', {
    Host: 'novyway.com',
    Cookie: `__Host-sovet_session=${encodeURIComponent(token)}; __Host-sovet_csrf=${encodeURIComponent(csrfToken)}`,
  })
  const body = JSON.parse(authenticated.body)
  if (authenticated.status !== 200 || body.user?.id !== users[0].id) throw new Error('Persisted session was not restored by /api/me')
  if (body.user.activeAptosAddress !== null) throw new Error('Password session incorrectly inherited an external Aptos signature')

  const signed = await request('/api/me', {
    Host: 'novyway.com',
    Cookie: `__Host-sovet_session=${encodeURIComponent(signedToken)}; __Host-sovet_csrf=${encodeURIComponent(signedCsrfToken)}`,
  })
  const signedBody = JSON.parse(signed.body)
  if (signed.status !== 200 || signedBody.user?.activeAptosAddress?.toLowerCase() !== users[0].aptos_address.toLowerCase()) {
    throw new Error('Aptos-signed session did not preserve its actual signing address')
  }

  const canonical = await request('/profile?source=www', { Host: 'www.novyway.com' })
  if (canonical.status !== 308 || canonical.headers.location !== 'https://novyway.com/profile?source=www') {
    throw new Error('www hostname is not redirected to the canonical session host')
  }

  console.log(JSON.stringify({
    persistentCookie: true,
    restoredUser: body.user.id,
    passwordSessionHasNoExternalSignature: true,
    signedSessionPreservedAddress: true,
    canonicalRedirect: canonical.headers.location,
  }, null, 2))
} finally {
  await Promise.all([deleteSession(token), deleteSession(signedToken)])
  await closeStorage()
}
