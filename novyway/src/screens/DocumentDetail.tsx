import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useT } from '../i18n'
import { useDocuments, groupColors, groupNames, useSettings, useStore } from '../demo/store'
import { CatChip, PageHead, StatusChip, Switch } from '../ui/components'
import type { Clause } from '../domain/types'
import { sound } from '../sound/engine'

// ==========================================================
// Просмотр документа внутри сайта:
//  · изменяемые пункты подсвечены красным;
//  · hover/tap показывает предлагаемую редакцию;
//  · тумблер «Новая редакция» применяет все поправки
//    и помечает изменённые/новые места;
//  · клик по пункту ведёт к его голосованию.
// ==========================================================

export default function DocumentDetail() {
  const { id } = useParams()
  const { t, l } = useT()
  const { state } = useStore()
  const nav = useNavigate()
  const docs = useDocuments()
  const [showNew, setShowNew] = useState(false)
  const [hovered, setHovered] = useState<string | null>(null)

  const { s, update } = useSettings()
  const d = docs.find((x) => x.id === id)
  const docId = d?.id
  const alreadyRead = docId ? s.readDocs.includes(docId) : false
  // документ засчитывается в гражданский скор при первом открытии
  useEffect(() => {
    if (docId && !s.readDocs.includes(docId)) update({ readDocs: [...s.readDocs, docId] })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId])
  if (!d) return <div className="empty">{t('au.empty')}</div>
  const cat = state.categories.find((c) => c.id === d.categoryId)!

  return (
    <>
      <PageHead
        title={l(d.title)}
        sub={<span className="row" style={{ gap: 8 }}>
          <span className="chip mono mute" style={{ borderColor: groupColors[d.group], color: groupColors[d.group] }}>
            {l(groupNames[d.group])}
          </span>
          <CatChip cat={cat} />
          {alreadyRead && <span className="chip mute read-chip">{t('sc.readChip')}</span>}
        </span>}
        right={
          <Switch
            checked={showNew}
            onChange={(v) => { setShowNew(v); sound.play(v ? 'confirm' : 'tap') }}
            label={<span title={t('doc.showNewHint')}>{t('doc.showNew')}</span>}
          />
        }
      />

      <div className="callout" style={{ maxWidth: 800, marginBottom: 14 }}>{t('doc.hoverHint')}</div>

      <article className="doc-page">
        <h2>{l(d.title)}</h2>
        <div className="doc-meta">
          <span>{t('doc.version')} {d.version}</span>
          <span>{t('doc.hash')} {d.documentHash}</span>
          <span>{showNew ? t('el.proposedText') : t('el.currentText')}</span>
        </div>

        {d.clauses.map((c) => (
          <ClauseView
            key={c.id}
            clause={c}
            showNew={showNew}
            hovered={hovered === c.id}
            onHover={(h) => setHovered(h ? c.id : null)}
            onOpen={() => c.amendment && nav(`/elections/${c.amendment.electionId}`)}
          />
        ))}
      </article>

      <div style={{ marginTop: 14 }}>
        <Link to="/documents" className="muted">← {t('doc.title')}</Link>
      </div>
    </>
  )
}

function ClauseView({ clause: c, showNew, hovered, onHover, onOpen }: {
  clause: Clause
  showNew: boolean
  hovered: boolean
  onHover: (h: boolean) => void
  onOpen: () => void
}) {
  const { t, l } = useT()
  const { state } = useStore()
  const am = c.amendment
  const election = am ? state.elections.find((e) => e.id === am.electionId) : undefined

  // обычный пункт без поправки
  if (!am || !election) {
    return (
      <div className="clause">
        <span className="cnum">§ {c.num} · {l(c.title)}</span>
        {l(c.text)}
      </div>
    )
  }

  // режим «новая редакция»: применяем поправку, помечаем место
  if (showNew) {
    return (
      <div className="clause added-view">
        <span className="cnum">§ {c.num} · {l(c.title)}</span>
        {l(am.proposedText)}
        <span className="flag">
          <span className="chip ok">{am.kind === 'add' ? t('doc.added') : t('doc.changed')}</span>
        </span>
      </div>
    )
  }

  // оригинал: подсветка + hover-превью замены
  return (
    <div
      className="clause changed"
      role="button"
      tabIndex={0}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      onFocus={() => onHover(true)}
      onBlur={() => onHover(false)}
      onClick={onOpen}
      onKeyDown={(e) => e.key === 'Enter' && onOpen()}
      style={{ position: 'relative' }}
    >
      <span className="cnum">§ {c.num} · {l(c.title)}</span>
      {l(c.text)}
      <span className="flag">
        <StatusChip status={election.status} />
      </span>
      {hovered && (
        <div className="clause-pop" style={{ top: 'calc(100% + 4px)' }}>
          <div className="lbl">{t('doc.willReplace')} · {t('doc.election').toLowerCase()} {election.id}</div>
          {l(am.proposedText)}
          <div className="lbl" style={{ marginTop: 8, color: 'var(--cyan)' }}>
            {t('common.open')} → {l(election.title)}
          </div>
        </div>
      )}
    </div>
  )
}
