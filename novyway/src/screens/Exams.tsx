import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useT } from '../i18n'
import { ME, exams, useStore } from '../demo/store'
import { CatChip, Lvl, PageHead } from '../ui/components'
import { questionCount } from '../domain/exams'

export default function Exams() {
  const { t, l } = useT()
  const { state } = useStore()
  const nav = useNavigate()
  const [params] = useSearchParams()
  const [categoryId, setCategoryId] = useState(params.get('category') ?? 'all')
  const [level, setLevel] = useState('all')
  const visibleExams = exams.filter((exam) => (categoryId === 'all' || exam.categoryId === categoryId) && (level === 'all' || exam.targetLevel === Number(level)))

  return (
    <>
      <PageHead title={t('xm.title')} sub={t('xm.sub')} />
      <div className="exam-catalog-toolbar panel tight">
        <label className="field"><span>{t('common.category')}</span><select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="all">{t('common.all')}</option>{state.categories.map((category) => <option key={category.id} value={category.id}>{l(category.name)}</option>)}</select></label>
        <label className="field"><span>{t('common.level')}</span><select value={level} onChange={(event) => setLevel(event.target.value)}><option value="all">{t('common.all')}</option><option value="1">L1</option><option value="2">L2</option><option value="3">L3</option></select></label>
        <span className="chip mute mono">{visibleExams.length} {t('xm.title').toLowerCase()}</span>
      </div>
      <div className="grid c3">
        {visibleExams.map((x) => {
          const cat = state.categories.find((c) => c.id === x.categoryId)!
          const myQ = state.qualifications
            .filter((q) => q.voter === ME && q.categoryId === x.categoryId)
            .sort((a, b) => b.revision - a.revision)[0]
          return (
            <button
              key={x.id}
              className="panel exam-card"
              style={{ textAlign: 'left', cursor: 'pointer', borderTop: `4px solid ${cat.color}` }}
              onClick={() => nav(`/exams/${x.id}`)}
            >
              <div className="row between" style={{ marginBottom: 8 }}>
                <CatChip cat={cat} />
                <span className="row" style={{ gap: 4 }}>
                  {myQ && <><Lvl level={myQ.level} /> <span className="muted">→</span></>}
                  <Lvl level={x.targetLevel} />
                </span>
              </div>
              <h3 style={{ fontSize: 16, marginBottom: 6 }}>{l(x.title)}</h3>
              <div className="mono muted" style={{ fontSize: 11.5 }}>
                {questionCount(x)} {t('xm.q').toLowerCase()} · {x.minutes} {t('xm.minutes')} · {t('xm.pass').toLowerCase()} {Math.round(x.passShare * 100)}%
              </div>
              <div className="exam-card-sources">{x.sources.slice(0, 2).map((source) => <span key={source.url}>{l(source.label)}</span>)}</div>
            </button>
          )
        })}
      </div>
      <div className="callout yellow" style={{ marginTop: 16, maxWidth: 720 }}>
        {t('xm.pendingNote')}
      </div>
    </>
  )
}
