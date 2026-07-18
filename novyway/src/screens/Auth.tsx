import { useT } from '../i18n'
import { AuthPanel } from '../ui/components/AuthPanel'
import { PageHead } from '../ui/components'
import { useAccountSession } from '../auth/session'

export default function Auth() {
  const { lang } = useT()
  const { user } = useAccountSession()
  const ru = lang === 'ru'
  return <>
    <PageHead
      title={user ? (ru ? 'Способы входа' : 'Sign-in methods') : (ru ? 'Вход в Новый Путь' : 'Sign in to Novyway')}
      sub={user
        ? (ru ? 'Подключите или активируйте способ подтверждения, не выходя из текущего аккаунта.' : 'Link or activate a confirmation method without leaving your current account.')
        : (ru ? 'Один аккаунт для профиля, квалификаций и подписанных голосов.' : 'One account for your profile, qualifications, and signed votes.')}
    />
    <div style={{ maxWidth: 620 }}><AuthPanel /></div>
  </>
}
