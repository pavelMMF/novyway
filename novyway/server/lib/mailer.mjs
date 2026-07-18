import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import nodemailer from 'nodemailer'
import { secretsRoot } from './runtime-paths.mjs'

function mailConfig() {
  const path = join(secretsRoot, 'mail.json')
  if (existsSync(path)) return JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''))
  if (!process.env.SMTP_HOST) return null
  return {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === '1',
    user: process.env.SMTP_USER,
    password: process.env.SMTP_PASSWORD,
    from: process.env.SMTP_FROM,
  }
}

export function emailDeliveryConfigured() {
  const config = mailConfig()
  return Boolean(config?.host && config?.port && config?.user && config?.password && config?.from)
}

export async function sendVerificationCode({ to, code, purpose, lang = 'ru' }) {
  const config = mailConfig()
  if (!config?.host || !config?.port || !config?.user || !config?.password || !config?.from) {
    throw Object.assign(new Error('email_delivery_not_configured'), { status: 503 })
  }
  const transport = nodemailer.createTransport({
    host: config.host,
    port: Number(config.port),
    secure: Boolean(config.secure),
    auth: { user: config.user, pass: config.password },
  })
  const isRu = lang === 'ru'
  const subject = purpose === 'register'
    ? (isRu ? 'Код регистрации в Новый Путь' : 'Novyway registration code')
    : purpose === 'password_reset'
      ? (isRu ? 'Код восстановления пароля' : 'Password recovery code')
    : purpose === 'change_email_old'
      ? (isRu ? 'Подтвердите смену почты' : 'Confirm the email change')
      : (isRu ? 'Подтвердите новую почту' : 'Confirm your new email')
  const text = isRu
    ? `Ваш одноразовый код: ${code}\n\nОн действует 10 минут. Если вы не запрашивали код, ничего не делайте.`
    : `Your one-time code: ${code}\n\nIt expires in 10 minutes. If you did not request it, ignore this message.`
  await transport.sendMail({ from: config.from, to, subject, text })
}

export async function sendPasswordChangedNotice({ to, lang = 'ru' }) {
  const config = mailConfig()
  if (!config?.host || !config?.port || !config?.user || !config?.password || !config?.from) return
  const transport = nodemailer.createTransport({
    host: config.host,
    port: Number(config.port),
    secure: Boolean(config.secure),
    auth: { user: config.user, pass: config.password },
  })
  const isRu = lang === 'ru'
  await transport.sendMail({
    from: config.from,
    to,
    subject: isRu ? 'Пароль Нового Пути изменён' : 'Your Novyway password was changed',
    text: isRu
      ? 'Пароль вашего аккаунта был изменён, а все активные сеансы завершены. Если это сделали не вы, свяжитесь с оператором проекта.'
      : 'Your account password was changed and all active sessions were closed. If this was not you, contact the project operator.',
  })
}
