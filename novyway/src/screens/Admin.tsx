import { useMemo, useState } from 'react'
import { fmtDate, useT } from '../i18n'
import { exams, groupCountsOf, useDocuments, useStore } from '../demo/adminHelpers'
import { AccountRef, KV, Lvl, PageHead, Panel } from '../ui/components'
import { bpsToPct, computeSnapshot, fmtW } from '../domain/weights'
import { sound } from '../sound/engine'
import type { Election, ElectionSnapshot } from '../domain/types'
import { useGovernanceAdmin } from '../ui/components/GovernanceAdminGate'
import { AdminMembership } from '../ui/components/AdminMembership'
import { useAccountSession } from '../auth/session'

type Tab = 'admins' | 'quals' | 'policies' | 'election' | 'content' | 'log'

export default function Admin() {
  const { t, lang } = useT()
  const admin = useGovernanceAdmin()
  const { user } = useAccountSession()
  const canManageMembership = admin.isCreator && user?.isSuperAdmin === true
  const [tab, setTab] = useState<Tab>(canManageMembership ? 'admins' : 'quals')

  const tabs: { id: Tab; label: string }[] = [
    ...(canManageMembership ? [{ id: 'admins' as const, label: lang === 'ru' ? 'Состав Совета' : 'Council membership' }] : []),
    { id: 'quals', label: t('ad.quals') },
    { id: 'policies', label: t('ad.policies') },
    { id: 'election', label: t('ad.newElection') },
    { id: 'content', label: t('ad.content') },
    { id: 'log', label: t('ad.log') },
  ]

  return (
    <>
      <PageHead
        title={lang === 'ru' ? 'Управление Советом' : 'Council governance'}
        sub={lang === 'ru' ? 'On-chain роли, квалификации, политики весов, категории и голосования.' : 'On-chain roles, qualifications, weight policies, categories, and elections.'}
        right={<span className="chip crit mono">{t('ad.threshold')}: {admin.threshold}/{admin.administrators.length}</span>}
      />
      <div className="callout cyan governance-scope-note">
        <strong>{lang === 'ru' ? 'Это админ-панель Совета.' : 'This is the Council governance console.'}</strong>{' '}
        {lang === 'ru' ? 'Она не управляет сервером, PostgreSQL, доменом или резервными копиями. Эти функции доступны только локально через Sovet-Online-Admin.exe.' : 'It does not manage the server, PostgreSQL, domain, or backups. Those controls are local-only in Sovet-Online-Admin.exe.'}
      </div>
      <div className="grid c3 governance-live-strip">
        <Panel tight title={lang === 'ru' ? 'Администраторы' : 'Administrators'}><strong className="mono">{admin.administrators.length}</strong><span className="muted"> · {lang === 'ru' ? 'порог' : 'threshold'} {admin.threshold}</span></Panel>
        <Panel tight title={lang === 'ru' ? 'Версии состояния' : 'State versions'}><span className="mono">{admin.versions.join(' / ')}</span></Panel>
        <Panel tight title={lang === 'ru' ? 'Ваш Aptos-адрес' : 'Your Aptos address'}><span className="mono governance-address">{admin.address}</span></Panel>
      </div>
      <div className="callout green governance-draft-note">{lang === 'ru' ? 'Состав Совета и выборы администраторов работают напрямую через Aptos Testnet. Остальные редакторы ниже пока сохраняют демонстрационные черновики.' : 'Council membership and administrator elections now operate directly through Aptos Testnet. The remaining editors below still save demonstration drafts.'}</div>
      <div className="seg admin-tabs" role="tablist" style={{ marginBottom: 16 }}>
        {tabs.map((x) => (
          <button key={x.id} role="tab" aria-selected={tab === x.id} className={tab === x.id ? 'on' : ''} onClick={() => setTab(x.id)}>{x.label}</button>
        ))}
      </div>
      {tab === 'admins' && canManageMembership && <AdminMembership governance={admin} />}
      {tab === 'quals' && <QualQueue />}
      {tab === 'policies' && <PolicyEditor />}
      {tab === 'election' && <NewElection />}
      {tab === 'content' && <ContentManager />}
      {tab === 'log' && <AdminLog />}
    </>
  )
}

// ---------- темы документов и пользовательские графы ----------

function ContentManager() {
  const { t, l } = useT()
  const { state, dispatch } = useStore()
  const docs = useDocuments()
  const [topicName, setTopicName] = useState('')
  const [topicColor, setTopicColor] = useState('#00A9BD')
  const [documentId, setDocumentId] = useState(docs[0]?.id ?? '')
  const currentDocument = docs.find((document) => document.id === documentId)
  const [primaryTopicId, setPrimaryTopicId] = useState(currentDocument?.primaryTopicId ?? state.topics[0]?.id ?? '')
  const [secondaryTopicIds, setSecondaryTopicIds] = useState<string[]>(currentDocument?.secondaryTopicIds ?? [])
  const [relationFrom, setRelationFrom] = useState(docs[0]?.id ?? '')
  const [relationTo, setRelationTo] = useState(docs[1]?.id ?? docs[0]?.id ?? '')
  const [relationLabel, setRelationLabel] = useState('Связан с')
  const [spaceName, setSpaceName] = useState('')
  const [spaceDocuments, setSpaceDocuments] = useState<string[]>(docs.slice(0, 2).map((document) => document.id))

  function selectDocument(id: string) {
    const document = docs.find((item) => item.id === id)
    setDocumentId(id)
    setPrimaryTopicId(document?.primaryTopicId ?? state.topics[0]?.id ?? '')
    setSecondaryTopicIds(document?.secondaryTopicIds ?? [])
  }

  return (
    <div className="grid c2 admin-content-grid">
      <Panel title={t('doc.primaryTopic')} hint={`${state.topics.length}`}>
        <div className="stack">
          <div className="row">
            <label className="field grow"><span>RU / EN</span><input value={topicName} onChange={(event) => setTopicName(event.target.value)} placeholder="Городская среда / Urban environment" /></label>
            <label className="field color-field"><span>Цвет</span><input type="color" value={topicColor} onChange={(event) => setTopicColor(event.target.value)} /></label>
          </div>
          <button className="btn primary small" disabled={!topicName.trim()} onClick={() => {
            const [ru, en = ru] = topicName.split('/').map((value) => value.trim())
            dispatch({ type: 'ADD_TOPIC', topic: { id: `topic-${Date.now()}`, name: { ru, en }, color: topicColor } })
            setTopicName('')
          }}>+ {t('common.save')}</button>
          <div className="topic-row">
            {state.topics.map((topic) => <span key={topic.id} className="chip" style={{ borderColor: topic.color }}>{l(topic.name)}</span>)}
          </div>
        </div>
      </Panel>

      <Panel title={t('doc.secondaryTopics')}>
        <div className="stack">
          <select value={documentId} onChange={(event) => selectDocument(event.target.value)}>
            {docs.map((document) => <option key={document.id} value={document.id}>{l(document.title)}</option>)}
          </select>
          <label className="field"><span>{t('doc.primaryTopic')}</span>
            <select value={primaryTopicId} onChange={(event) => setPrimaryTopicId(event.target.value)}>
              {state.topics.map((topic) => <option key={topic.id} value={topic.id}>{l(topic.name)}</option>)}
            </select>
          </label>
          <div className="check-grid">
            {state.topics.filter((topic) => topic.id !== primaryTopicId).map((topic) => (
              <label key={topic.id} className="check-row"><input type="checkbox" checked={secondaryTopicIds.includes(topic.id)} onChange={(event) => setSecondaryTopicIds((current) => event.target.checked ? [...current, topic.id] : current.filter((id) => id !== topic.id))} /><span>{l(topic.name)}</span></label>
            ))}
          </div>
          <button className="btn primary small" onClick={() => dispatch({ type: 'SET_DOCUMENT_TOPICS', documentId, primaryTopicId, secondaryTopicIds })}>{t('common.save')}</button>
        </div>
      </Panel>

      <Panel title={t('gr.connections')}>
        <div className="stack">
          <select value={relationFrom} onChange={(event) => setRelationFrom(event.target.value)}>{docs.map((document) => <option key={document.id} value={document.id}>{l(document.title)}</option>)}</select>
          <select value={relationTo} onChange={(event) => setRelationTo(event.target.value)}>{docs.map((document) => <option key={document.id} value={document.id}>{l(document.title)}</option>)}</select>
          <input value={relationLabel} onChange={(event) => setRelationLabel(event.target.value)} />
          <button className="btn primary small" disabled={relationFrom === relationTo || !relationLabel.trim()} onClick={() => {
            dispatch({ type: 'ADD_GRAPH_RELATION', relation: { id: `relation-${Date.now()}`, fromDocumentId: relationFrom, toDocumentId: relationTo, label: { ru: relationLabel, en: relationLabel } } })
          }}>+ {t('gr.connections')}</button>
          <span className="muted">{state.graphRelations.length} · {t('gr.connections').toLowerCase()}</span>
        </div>
      </Panel>

      <Panel title={t('doc.graphSpace')} hint={`${state.graphSpaces.length}`}>
        <div className="stack">
          <input value={spaceName} onChange={(event) => setSpaceName(event.target.value)} placeholder={t('doc.graphSpace')} />
          <div className="check-grid">
            {docs.map((document) => (
              <label key={document.id} className="check-row"><input type="checkbox" checked={spaceDocuments.includes(document.id)} onChange={(event) => setSpaceDocuments((current) => event.target.checked ? [...current, document.id] : current.filter((id) => id !== document.id))} /><span>{l(document.title)}</span></label>
            ))}
          </div>
          <button className="btn primary small" disabled={!spaceName.trim() || spaceDocuments.length === 0} onClick={() => {
            dispatch({ type: 'ADD_GRAPH_SPACE', space: { id: `space-${Date.now()}`, name: { ru: spaceName, en: spaceName }, documentIds: spaceDocuments } })
            setSpaceName('')
          }}>+ {t('doc.graphSpace')}</button>
        </div>
      </Panel>
    </div>
  )
}

// ---------- очередь квалификаций ----------

function QualQueue() {
  const { t, l, lang } = useT()
  const { state, dispatch } = useStore()
  const pending = state.attempts.filter((a) => a.status === 'passed_pending_admin')

  return (
    <Panel title={t('ad.quals')} hint={`${pending.length}`}>
      {pending.length === 0 ? (
        <div className="empty">{t('ad.emptyQueue')}</div>
      ) : (
        <table className="tbl responsive">
          <thead>
            <tr>
              <th>{t('common.actor')}</th><th>{t('xm.title')}</th><th>{t('xm.yourScore')}</th>
              <th>{t('pr.evidence')}</th><th></th>
            </tr>
          </thead>
          <tbody>
            {pending.map((a) => {
              const x = exams.find((e) => e.id === a.examId)!
              return (
                <tr key={a.id}>
                  <td data-l={t('common.actor')}><AccountRef address={a.voter} /></td>
                  <td data-l={t('xm.title')}>
                    {l(x.title)} → <Lvl level={x.targetLevel} />
                    <div className="muted mono" style={{ fontSize: 11 }}>{fmtDate(a.at, lang, true)}</div>
                  </td>
                  <td data-l="%" className="mono">{Math.round(a.scoreShare * 100)}%</td>
                  <td data-l={t('pr.evidence')} className="mono muted" style={{ fontSize: 11 }}>{a.evidenceHash}</td>
                  <td>
                    <button
                      className="btn small primary"
                      onClick={() => {
                        dispatch({
                          type: 'APPROVE_ATTEMPT', attemptId: a.id,
                          human: {
                            ru: `Подтверждён уровень L${x.targetLevel} (${x.title.ru}) для ${a.voter.slice(0, 8)}…`,
                            en: `Level L${x.targetLevel} confirmed (${x.title.en}) for ${a.voter.slice(0, 8)}…`,
                          },
                        })
                        dispatch({ type: 'TOAST', text: t('ad.approved') })
                        sound.play('confirm')
                      }}
                    >
                      {t('ad.approve')} 1/1
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </Panel>
  )
}

// ---------- политики: квоты, floors, cap + предрасчёт ----------

function PolicyEditor() {
  const { t, l } = useT()
  const { state, dispatch } = useStore()
  const [catId, setCatId] = useState(state.categories[0].id)
  const cat = state.categories.find((c) => c.id === catId)!
  const [quotas, setQuotas] = useState<[number, number, number, number]>([...cat.policy.quotaBps])
  const [floors, setFloors] = useState<[number, number, number, number]>([...cat.policy.floorWeights])
  const [cap, setCap] = useState(cat.policy.maxIndividualWeight)

  function pick(id: string) {
    const c = state.categories.find((x) => x.id === id)!
    setCatId(id)
    setQuotas([...c.policy.quotaBps])
    setFloors([...c.policy.floorWeights])
    setCap(c.policy.maxIndividualWeight)
  }

  const counts = groupCountsOf(catId)
  const preview = useMemo(
    () => computeSnapshot(counts, { quotaBps: quotas, floorWeights: floors, maxIndividualWeight: cap }),
    [counts, quotas, floors, cap],
  )
  const quotaSum = quotas.reduce((a, b) => a + b, 0)

  return (
    <div className="grid c2">
      <Panel title={t('ad.policies')} hint={`${l(cat.name)} · policy v${cat.policy.policyVersion}`}>
        <div className="stack">
          <select value={catId} onChange={(e) => pick(e.target.value)}>
            {state.categories.map((c) => <option key={c.id} value={c.id}>{l(c.name)}</option>)}
          </select>

          <div>
            <div className="muted" style={{ marginBottom: 6 }}>{t('ad.quotas')} (q0…q3, %)</div>
            <div className="grid c4">
              {quotas.map((q, i) => (
                <label className="field" key={i}>
                  <span>q{i} · <Lvl level={i} /></span>
                  <input
                    type="number" min={0} max={100} value={q / 100}
                    onChange={(e) => {
                      const next = [...quotas] as typeof quotas
                      next[i] = Math.round(Number(e.target.value) * 100)
                      setQuotas(next)
                    }}
                  />
                </label>
              ))}
            </div>
            <div className="mono" style={{ marginTop: 6, fontSize: 12.5, color: quotaSum === 10000 ? 'var(--lime-ink)' : 'var(--red)' }}>
              {t('ad.quotaSum')}: {(quotaSum / 100).toFixed(1)}% {quotaSum !== 10000 && '≠ 100%'}
            </div>
          </div>

          <div>
            <div className="muted" style={{ marginBottom: 6 }}>{t('ad.floors')} (f0…f3)</div>
            <div className="grid c4">
              {floors.map((f, i) => (
                <label className="field" key={i}>
                  <span>f{i}</span>
                  <input
                    type="number" step={0.1} min={1} value={f} disabled={i === 0}
                    onChange={(e) => {
                      const next = [...floors] as typeof floors
                      next[i] = Number(e.target.value)
                      setFloors(next)
                    }}
                  />
                </label>
              ))}
            </div>
          </div>

          <label className="field" style={{ maxWidth: 180 }}>
            <span>{t('ad.cap')}</span>
            <input type="number" min={1} value={cap} onChange={(e) => setCap(Number(e.target.value))} />
          </label>

          <div>
            <button
              className="btn danger"
              disabled={!preview.ok}
              onClick={() => {
                dispatch({
                  type: 'PUBLISH_POLICY', categoryId: catId, quotaBps: quotas, floors, cap,
                  human: {
                    ru: `Политика «${cat.name.ru}» v${cat.policy.policyVersion + 1}: квоты ${quotas.map((q) => q / 100).join('/')}, cap ${cap}`,
                    en: `Policy "${cat.name.en}" v${cat.policy.policyVersion + 1}: quotas ${quotas.map((q) => q / 100).join('/')}, cap ${cap}`,
                  },
                })
                dispatch({ type: 'TOAST', text: `${t('ad.policyPublished')}: v${cat.policy.policyVersion + 1}` })
                sound.play('confirm')
              }}
            >
              {t('ad.applyPolicy')} → v{cat.policy.policyVersion + 1}
            </button>
          </div>
        </div>
      </Panel>

      <Panel title={t('ad.preview')} hint={`S = N0/q0 = ${fmtW(preview.scaleS)}`}>
        <div className="table-scroll" tabIndex={0} aria-label={t('ad.preview')}>
        <table className="tbl admin-preview-table">
          <thead>
            <tr><th>{t('common.level')}</th><th>N</th><th>q</th><th>T</th><th>w</th><th>Σ</th></tr>
          </thead>
          <tbody>
            {preview.groups.map((g, k) => (
              <tr key={k}>
                <td><Lvl level={k} /></td>
                <td className="mono">{g.count}</td>
                <td className="mono">{bpsToPct(g.quotaBps, 1)}</td>
                <td className="mono">{fmtW(g.targetUnits)}</td>
                <td className="mono" style={{ fontWeight: 600 }}>{fmtW(g.perAccountWeight)}</td>
                <td className="mono">{fmtW(g.count * g.perAccountWeight)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        <div className="row" style={{ marginTop: 10 }}>
          <KV k="eligible weight" v={fmtW(preview.eligibleWeight)} big />
        </div>
        <div style={{ marginTop: 10 }}>
          {preview.ok
            ? <div className="callout lime">✓ {t('ad.snapshotOk')}</div>
            : preview.problems.map((p) => (
                <div className="callout red" key={p.code} style={{ marginBottom: 6 }}>
                  <span className="mono" style={{ fontSize: 11 }}>{p.code}</span> · {l(p)}
                </div>
              ))}
        </div>
      </Panel>
    </div>
  )
}

// ---------- создание голосования ----------

function NewElection() {
  const { t, l } = useT()
  const { state, dispatch } = useStore()
  const docs = useDocuments()
  const free = state.amendments.filter((a) =>
    !state.elections.some((e) => e.amendmentId === a.id))
  const [amId, setAmId] = useState(free[0]?.id ?? '')
  const [days, setDays] = useState(21)
  const [quorum, setQuorum] = useState(30)
  const [pass, setPass] = useState(50)

  const am = free.find((a) => a.id === amId)
  const doc = am ? docs.find((d) => d.id === am.documentId) : undefined
  const cat = doc ? state.categories.find((c) => c.id === doc.categoryId) : undefined
  const counts = cat ? groupCountsOf(cat.id) : undefined
  const preview = cat && counts ? computeSnapshot(counts, cat.policy) : undefined

  return (
    <div className="grid c2">
      <Panel title={t('ad.newElection')} hint={t('ad.amendmentFree')}>
        {free.length === 0 ? (
          <div className="empty">{t('ad.emptyQueue')}</div>
        ) : (
          <div className="stack">
            <select value={amId} onChange={(e) => setAmId(e.target.value)}>
              {free.map((a) => {
                const d = docs.find((x) => x.id === a.documentId)!
                const c = d.clauses.find((x) => x.id === a.clauseId)!
                return <option key={a.id} value={a.id}>{a.id} · {l(d.title)} § {c.num}</option>
              })}
            </select>
            {am && doc && (
              <div className="callout">
                <div className="mono muted" style={{ fontSize: 11, marginBottom: 4 }}>
                  {t('el.proposedText')} · {am.amendmentHash}
                </div>
                {l(am.proposedText)}
              </div>
            )}
            <div className="grid c3">
              <label className="field"><span>{t('common.deadline')} (+{t('common.days')})</span>
                <input type="number" min={3} max={90} value={days} onChange={(e) => setDays(Number(e.target.value))} /></label>
              <label className="field"><span>{t('common.quorum')} %</span>
                <input type="number" min={5} max={100} value={quorum} onChange={(e) => setQuorum(Number(e.target.value))} /></label>
              <label className="field"><span>{t('el.needed')} %</span>
                <input type="number" min={50} max={100} value={pass} onChange={(e) => setPass(Number(e.target.value))} /></label>
            </div>
            <div>
              <button
                className="btn danger"
                disabled={!am || !preview?.ok}
                onClick={() => {
                  if (!am || !doc || !cat || !preview) return
                  const now = new Date()
                  const eid = `e-${108 + state.elections.length - 7}`
                  const snapId = Math.max(...state.snapshots.map((s) => s.id)) + 1
                  const snapshot: ElectionSnapshot = {
                    id: snapId, electionId: eid, categoryId: cat.id,
                    policyVersion: cat.policy.policyVersion,
                    registryVersion: cat.registryVersion,
                    registrationCutoff: now.toISOString(),
                    groups: preview.groups as ElectionSnapshot['groups'],
                    scaleS: preview.scaleS,
                    eligibleWeight: preview.eligibleWeight,
                    manifestHash: `0x${(snapId * 48271 % 0xfffffff).toString(16)}cafe` as `0x${string}`,
                  }
                  const clause = doc.clauses.find((x) => x.id === am.clauseId)!
                  const election: Election = {
                    id: eid, categoryId: cat.id, documentId: doc.id, amendmentId: am.id,
                    title: {
                      ru: `Поправка § ${clause.num}: ${clause.title.ru}`,
                      en: `Amendment § ${clause.num}: ${clause.title.en}`,
                    },
                    startsAt: now.toISOString(),
                    endsAt: new Date(now.getTime() + days * 86400000).toISOString(),
                    quorumBps: quorum * 100, passBps: pass * 100,
                    snapshotId: snapId, status: 'active', allowRevote: true,
                  }
                  dispatch({
                    type: 'CREATE_ELECTION', election, snapshot,
                    amendment: { ...am, electionId: eid },
                    human: {
                      ru: `Создано голосование ${eid} по поправке ${am.id} (снимок #${snapId})`,
                      en: `Election ${eid} created for amendment ${am.id} (snapshot #${snapId})`,
                    },
                  })
                  dispatch({ type: 'TOAST', text: `${t('ad.electionCreated')} #${snapId}` })
                  sound.play('receipt')
                }}
              >
                {t('ad.createElection')}
              </button>
            </div>
          </div>
        )}
      </Panel>

      {preview && cat && (
        <Panel title={t('ad.preview')} hint={`${l(cat.name)} · policy v${cat.policy.policyVersion}`}>
          <div className="table-scroll" tabIndex={0} aria-label={t('ad.preview')}>
          <table className="tbl admin-preview-table">
            <thead><tr><th>{t('common.level')}</th><th>N</th><th>T</th><th>w</th></tr></thead>
            <tbody>
              {preview.groups.map((g, k) => (
                <tr key={k}>
                  <td><Lvl level={k} /></td>
                  <td className="mono">{g.count}</td>
                  <td className="mono">{fmtW(g.targetUnits)}</td>
                  <td className="mono" style={{ fontWeight: 600 }}>{fmtW(g.perAccountWeight)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          <div style={{ marginTop: 10 }}>
            {preview.ok
              ? <div className="callout lime">✓ {t('ad.snapshotOk')} · eligible {fmtW(preview.eligibleWeight)}</div>
              : <div className="callout red">{t('ad.snapshotBad')}</div>}
          </div>
        </Panel>
      )}
    </div>
  )
}

// ---------- журнал ----------

function AdminLog() {
  const { t, l, lang } = useT()
  const { state } = useStore()
  const rows = state.audit.filter((a) => ['policy', 'qualification', 'election_created', 'finalized', 'admin', 'snapshot'].includes(a.type))
  return (
    <Panel title={t('ad.log')}>
      <table className="tbl responsive">
        <tbody>
          {rows.map((ev) => (
            <tr key={ev.id}>
              <td data-l={t('common.date')} className="mono muted" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{fmtDate(ev.at, lang, true)}</td>
              <td data-l={t('au.type')}><span className="chip mono mute">{ev.type}</span></td>
              <td data-l={t('common.event')}>{l(ev.human)}</td>
              <td data-l="tx" className="mono muted" style={{ fontSize: 11 }}>{ev.txHash}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  )
}
