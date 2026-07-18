import { PageHead, Panel } from '../ui/components'
import { SignalCircuit } from '../ui/components/SignalCircuit'
import { useT } from '../i18n'

export default function SignalGame() {
  const { lang } = useT()
  const ru = lang === 'ru'
  return (
    <>
      <PageHead title={ru ? 'Лаборатория аргументов' : 'Argument lab'} sub={ru ? 'Найдите логическую ошибку, разберите объяснение и соберите личный счёт.' : 'Find the logical flaw, review the explanation, and build your personal score.'} />
      <Panel className="signal-game"><SignalCircuit /></Panel>
    </>
  )
}
