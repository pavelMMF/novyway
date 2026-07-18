import {
  decryptManagedPrivateKey,
  encryptManagedPrivateKey,
  hashEmailCode,
  hashPassword,
  verifyPassword,
} from './lib/credentials.mjs'

const password = 'correct horse battery staple'
const passwordHash = await hashPassword(password)
const envelope = encryptManagedPrivateKey('0x0123456789abcdef')
const oldEmailCode = hashEmailCode({ userId: 'test-user', purpose: 'change_email_old', email: 'New@Example.com', code: '123456' })
const newEmailCode = hashEmailCode({ userId: 'test-user', purpose: 'change_email_new', email: 'new@example.com', code: '123456' })

const checks = {
  passwordAccepted: await verifyPassword(password, passwordHash),
  wrongPasswordRejected: !await verifyPassword('wrong password', passwordHash),
  malformedHashRejected: !await verifyPassword(password, 'scrypt$999999999$8$1$AA$AA'),
  walletRoundTrip: decryptManagedPrivateKey(envelope) === '0x0123456789abcdef',
  emailStagesSeparated: oldEmailCode !== newEmailCode,
  rawCodeNotStored: !oldEmailCode.includes('123456') && !newEmailCode.includes('123456'),
}

console.log(JSON.stringify(checks, null, 2))
if (Object.values(checks).some((value) => !value)) process.exitCode = 1
