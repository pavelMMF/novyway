import { sendVerificationCode } from './lib/mailer.mjs'

const recipient = process.argv[2]
if (!recipient || !recipient.includes('@')) {
  console.error('Usage: node server/Test-Mail.mjs recipient@example.com')
  process.exit(2)
}

await sendVerificationCode({
  to: recipient,
  code: '123456',
  purpose: 'register',
  lang: 'ru',
})
console.log('Test message accepted by the configured SMTP server.')
