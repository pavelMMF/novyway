// ==========================================================
// Demo-runtime: детерминированный демонстрационный набор данных.
// Не является источником истины — имитирует ответы Aptos read gateway.
// ==========================================================

import type {
  AuditEvent, Category, DocumentModel, Election, ElectionSnapshot,
  Exam, ExamAttempt, ExamQuestion, Person, QualificationRevision, Receipt, Tally, Vote,
} from '../domain/types'
import { computeSnapshot } from '../domain/weights'
import { examCatalog } from './examCatalog'

export const ME = '0xa11ce97f30c2'

export const persons: Person[] = [
  { address: ME, name: { ru: 'Андрей Соколов', en: 'Andrew Sokolov' }, role: 'voter', registeredAt: '2026-02-14' },
  { address: '0xad0173bb41e0', name: { ru: 'Мария Ланге', en: 'Maria Lange' }, role: 'admin', registeredAt: '2026-01-09' },
  { address: '0xbeef5501ac77', name: { ru: 'Илья Крылов', en: 'Ilya Krylov' }, role: 'voter', registeredAt: '2026-02-20' },
  { address: '0xc0de9128fa03', name: { ru: 'Ольга Вейс', en: 'Olga Weiss' }, role: 'voter', registeredAt: '2026-03-02' },
  { address: '0xe5e57a3d9b11', name: { ru: 'Тимур Арним', en: 'Timur Arnim' }, role: 'voter', registeredAt: '2026-03-15' },
  { address: '0xf00d3c67e421', name: { ru: 'Нина Роше', en: 'Nina Roche' }, role: 'voter', registeredAt: '2026-04-01' },
  { address: '0x9a7b44f10c55', name: { ru: 'Павел Гринев', en: 'Pavel Grinev' }, role: 'voter', registeredAt: '2026-04-11' },
  { address: '0xd00d81b2c9ee' }, // не зарегистрирован в реестре личностей
  { address: '0x77aa02e5d310' },
]

export const categories: Category[] = [
  {
    id: 'c-econ', slug: 'economy',
    name: { ru: 'Экономика', en: 'Economics' }, color: '#E64232',
    registryVersion: 12,
    policy: {
      categoryId: 'c-econ', policyVersion: 4,
      quotaBps: [2500, 1500, 2500, 3500],
      floorWeights: [1, 1.2, 2, 4],
      maxIndividualWeight: 25, active: true,
      metadataHash: '0x3f9c12aa04d1',
    },
  },
  {
    id: 'c-tech', slug: 'technology',
    name: { ru: 'Технологии', en: 'Technology' }, color: '#00A9BD',
    registryVersion: 9,
    policy: {
      categoryId: 'c-tech', policyVersion: 3,
      quotaBps: [3500, 2500, 2500, 1500],
      floorWeights: [1, 1.2, 2, 4],
      maxIndividualWeight: 15, active: true,
      metadataHash: '0x8b2e77c1f900',
    },
  },
  {
    id: 'c-law', slug: 'law',
    name: { ru: 'Право', en: 'Law' }, color: '#7B5EA7',
    registryVersion: 7,
    policy: {
      categoryId: 'c-law', policyVersion: 2,
      quotaBps: [3000, 2000, 2500, 2500],
      floorWeights: [1, 1.5, 2.5, 5],
      maxIndividualWeight: 20, active: true,
      metadataHash: '0x51ac0e9d23b7',
    },
  },
  {
    id: 'c-eco', slug: 'ecology',
    name: { ru: 'Экология', en: 'Ecology' }, color: '#679B1E',
    registryVersion: 5,
    policy: {
      categoryId: 'c-eco', policyVersion: 2,
      quotaBps: [4000, 2500, 2000, 1500],
      floorWeights: [1, 1.3, 2, 3.5],
      maxIndividualWeight: 12, active: true,
      metadataHash: '0xcd44f1a08e62',
    },
  },
  {
    id: 'c-edu', slug: 'education',
    name: { ru: 'Образование', en: 'Education' }, color: '#EFB31E',
    registryVersion: 6,
    policy: {
      categoryId: 'c-edu', policyVersion: 3,
      quotaBps: [3000, 2500, 2500, 2000],
      floorWeights: [1, 1.2, 2, 4],
      maxIndividualWeight: 12, active: true,
      metadataHash: '0x1e83ba55c04f',
    },
  },
]

// счётчики допущенных аккаунтов по уровням (Nk) на момент cutoff
export const groupCounts: Record<string, [number, number, number, number]> = {
  'c-econ': [70, 15, 10, 5],
  'c-tech': [90, 20, 12, 4],
  'c-law': [60, 12, 8, 3],
  'c-eco': [45, 10, 6, 2],
  'c-edu': [50, 14, 9, 4],
}

export const qualifications: QualificationRevision[] = [
  {
    voter: ME, categoryId: 'c-econ', level: 2, revision: 41,
    evidenceHash: '0xe11d02c39f70', confirmedAt: '2026-05-03',
    reason: { ru: 'Экзамен «Экономика L2», результат 86%', en: 'Exam "Economics L2", score 86%' },
  },
  {
    voter: ME, categoryId: 'c-tech', level: 1, revision: 37,
    evidenceHash: '0x9f31aa80d215', confirmedAt: '2026-04-19',
    reason: { ru: 'Экзамен «Технологии L1», результат 78%', en: 'Exam "Technology L1", score 78%' },
  },
  {
    voter: ME, categoryId: 'c-law', level: 0, revision: 12,
    evidenceHash: '0x0000c4a1b2d3', confirmedAt: '2026-02-14',
    reason: { ru: 'Регистрация в категории (базовый допуск L0)', en: 'Category registration (base L0 admission)' },
  },
  {
    voter: ME, categoryId: 'c-eco', level: 0, revision: 8,
    evidenceHash: '0x0000d5b2c3e4', confirmedAt: '2026-02-14',
    reason: { ru: 'Регистрация в категории (базовый допуск L0)', en: 'Category registration (base L0 admission)' },
  },
  {
    voter: '0xbeef5501ac77', categoryId: 'c-econ', level: 3, revision: 40,
    evidenceHash: '0xab7745e90c13', confirmedAt: '2026-04-28',
    reason: { ru: 'Экзамен «Экономика L3», результат 93%', en: 'Exam "Economics L3", score 93%' },
  },
  {
    voter: '0xc0de9128fa03', categoryId: 'c-law', level: 2, revision: 33,
    evidenceHash: '0x77d0be3f5a19', confirmedAt: '2026-04-10',
    reason: { ru: 'Экзамен «Право L2», результат 81%', en: 'Exam "Law L2", score 81%' },
  },
  {
    voter: '0xe5e57a3d9b11', categoryId: 'c-eco', level: 1, revision: 21,
    evidenceHash: '0x40cc17e8ba55', confirmedAt: '2026-05-22',
    reason: { ru: 'Экзамен «Экология L1», результат 75%', en: 'Exam "Ecology L1", score 75%' },
  },
]

// ---------- документы ----------

export const documents: DocumentModel[] = [
  {
    id: 'doc-charter', categoryId: 'c-law', group: 'charter',
    title: { ru: 'Устав Совета по управлению системой голосов', en: 'Charter of the Vote System Governance Council' },
    version: 'v3.1', documentHash: '0x5efc03a9d871',
    clauses: [
      {
        id: 'ch-1', num: '1.1',
        title: { ru: 'Предмет', en: 'Subject' },
        text: {
          ru: 'Совет управляет параметрами системы взвешенных голосований: квотами уровней, минимальными весами, порогами кворума и порядком подтверждения квалификаций.',
          en: 'The Council governs weighted-voting parameters: level quotas, floor weights, quorum thresholds, and qualification confirmation procedures.',
        },
      },
      {
        id: 'ch-2', num: '2.4',
        title: { ru: 'Состав', en: 'Composition' },
        text: {
          ru: 'Совет состоит из администраторов, внесённых в on-chain реестр. Изменение состава требует большинства действующих администраторов.',
          en: 'The Council consists of administrators recorded in the on-chain registry. Composition changes require a majority of acting administrators.',
        },
      },
      {
        id: 'ch-3', num: '4.2',
        title: { ru: 'Порог решений', en: 'Decision threshold' },
        text: {
          ru: 'Решения Совета принимаются простым большинством администраторов (N из M). При единственном администраторе порог равен 1/1.',
          en: 'Council decisions are taken by a simple majority of administrators (N of M). With a single administrator the threshold is 1/1.',
        },
      },
      {
        id: 'ch-4', num: '5.3',
        title: { ru: 'Публичность', en: 'Publicity' },
        text: {
          ru: 'Каждое административное действие публикуется с причиной и evidence hash и остаётся в публичной истории без права удаления.',
          en: 'Every administrative action is published with a reason and evidence hash and remains in public history without deletion rights.',
        },
      },
      {
        id: 'ch-5', num: '7.1',
        title: { ru: 'Экстренные процедуры', en: 'Emergency procedures' },
        text: {
          ru: 'Экстренная приостановка голосования не предусмотрена настоящей редакцией Устава.',
          en: 'Emergency suspension of an election is not provided for in this edition of the Charter.',
        },
      },
      {
        id: 'ch-6', num: '9.2',
        title: { ru: 'Пересмотр', en: 'Review' },
        text: {
          ru: 'Устав пересматривается по инициативе Совета либо по петиции, поддержанной не менее чем десятью процентами суммарного веса категории «Право».',
          en: 'The Charter is reviewed at the Council’s initiative or by petition supported by at least ten percent of the "Law" category’s total weight.',
        },
      },
    ],
  },
  {
    id: 'doc-monetary', categoryId: 'c-econ', group: 'policy',
    title: { ru: 'Положение о монетарной политике сообщества', en: 'Community Monetary Policy Regulation' },
    version: 'v2.4', documentHash: '0x9d02c7e1b430',
    clauses: [
      {
        id: 'mp-1', num: '1.2',
        title: { ru: 'Цели', en: 'Goals' },
        text: {
          ru: 'Монетарная политика направлена на предсказуемость бюджета сообщества и прозрачность распределения общих фондов.',
          en: 'Monetary policy aims at community budget predictability and transparent allocation of common funds.',
        },
      },
      {
        id: 'mp-2', num: '2.3',
        title: { ru: 'Резервный фонд', en: 'Reserve fund' },
        text: {
          ru: 'В резервный фонд направляется 10% ежемесячных поступлений. Средства резерва расходуются только по решению Совета.',
          en: 'The reserve fund receives 10% of monthly inflows. Reserve funds are spent only by Council decision.',
        },
      },
      {
        id: 'mp-3', num: '3.1',
        title: { ru: 'Гранты', en: 'Grants' },
        text: {
          ru: 'Грантовые выплаты утверждаются голосованием категории «Экономика» и публикуются с полным составом получателей.',
          en: 'Grant payouts are approved by an "Economics" category vote and published with the full recipient list.',
        },
      },
      {
        id: 'mp-4', num: '5.1',
        title: { ru: 'Отчётность', en: 'Reporting' },
        text: {
          ru: 'Финансовый отчёт публикуется ежеквартально в течение 30 дней после окончания квартала.',
          en: 'The financial report is published quarterly within 30 days after quarter end.',
        },
      },
    ],
  },
  {
    id: 'doc-exams', categoryId: 'c-edu', group: 'regulation',
    title: { ru: 'Регламент квалификационных экзаменов', en: 'Qualification Exam Regulations' },
    version: 'v1.7', documentHash: '0x44b1f08ce592',
    clauses: [
      {
        id: 'ex-1', num: '1.1',
        title: { ru: 'Назначение', en: 'Purpose' },
        text: {
          ru: 'Экзамен подтверждает уровень знаний в категории и приводит к предложению об изменении уровня, а не к фиксированной прибавке веса.',
          en: 'An exam confirms knowledge level in a category and results in a level-change proposal, not a fixed weight bonus.',
        },
      },
      {
        id: 'ex-2', num: '3.4',
        title: { ru: 'Повторная сдача', en: 'Retake' },
        text: {
          ru: 'Повторная сдача экзамена того же уровня допускается не ранее чем через 30 дней после предыдущей попытки.',
          en: 'A retake of the same-level exam is allowed no earlier than 30 days after the previous attempt.',
        },
      },
      {
        id: 'ex-3', num: '4.2',
        title: { ru: 'Подтверждение', en: 'Confirmation' },
        text: {
          ru: 'Результат экзамена вступает в силу после утверждения администраторами и создаёт новую qualification revision.',
          en: 'An exam result takes effect after administrator approval and creates a new qualification revision.',
        },
      },
    ],
  },
  {
    id: 'doc-opendata', categoryId: 'c-tech', group: 'standard',
    title: { ru: 'Стандарт открытых данных платформы', en: 'Platform Open Data Standard' },
    version: 'v1.2', documentHash: '0x7ac9e3f215d8',
    clauses: [
      {
        id: 'od-1', num: '1.2',
        title: { ru: 'Формат манифеста', en: 'Manifest format' },
        text: {
          ru: 'Снимок голосования публикуется в виде JSON-манифеста, хеш которого фиксируется on-chain.',
          en: 'An election snapshot is published as a JSON manifest whose hash is committed on-chain.',
        },
      },
      {
        id: 'od-2', num: '2.5',
        title: { ru: 'Доступ индексатора', en: 'Indexer access' },
        text: {
          ru: 'Индексатор обязан хранить хеши транзакций и sequence numbers событий, достаточные для независимой проверки.',
          en: 'The indexer must store transaction hashes and event sequence numbers sufficient for independent verification.',
        },
      },
    ],
  },
  {
    id: 'doc-forest', categoryId: 'c-eco', group: 'program',
    title: { ru: 'Программа восстановления городских лесов', en: 'Urban Forest Restoration Program' },
    version: 'v1.0', documentHash: '0xb31d55f7a2c6',
    clauses: [
      {
        id: 'fr-1', num: '1.1',
        title: { ru: 'Область', en: 'Scope' },
        text: {
          ru: 'Программа определяет порядок финансирования и контроля посадок в городских лесопарковых зонах.',
          en: 'The program defines funding and oversight of planting in urban forest-park zones.',
        },
      },
      {
        id: 'fr-2', num: '2.2',
        title: { ru: 'Критерии участков', en: 'Site criteria' },
        text: {
          ru: 'Участки отбираются по индексу деградации почвы и плотности существующих насаждений.',
          en: 'Sites are selected by soil degradation index and existing canopy density.',
        },
      },
    ],
  },
]

// ---------- поправки (amendments) ----------
// связываются в store: одна поправка = одно голосование

export interface AmendmentSeed {
  id: string
  documentId: string
  clauseId: string
  kind: 'change' | 'add'
  proposedText: { ru: string; en: string }
  rationale: { ru: string; en: string }
  amendmentHash: `0x${string}`
  electionId: string
}

export const amendments: AmendmentSeed[] = [
  {
    id: 'am-1', documentId: 'doc-charter', clauseId: 'ch-3', kind: 'change',
    electionId: 'e-101', amendmentHash: '0x21f3d0c88a17',
    proposedText: {
      ru: 'Решения Совета принимаются квалифицированным большинством в две трети администраторов (⌈2M/3⌉ из M). При единственном администраторе порог равен 1/1.',
      en: 'Council decisions are taken by a qualified two-thirds majority of administrators (⌈2M/3⌉ of M). With a single administrator the threshold is 1/1.',
    },
    rationale: {
      ru: 'Простое большинство при чётном числе администраторов допускает спорные решения 3/5; две трети повышают устойчивость.',
      en: 'Simple majority with an even admin count allows contested 3/5 decisions; two thirds improve robustness.',
    },
  },
  {
    id: 'am-2', documentId: 'doc-charter', clauseId: 'ch-5', kind: 'change',
    electionId: 'e-102', amendmentHash: '0x8e44ab2c95f0',
    proposedText: {
      ru: 'Совет вправе экстренно приостановить голосование при обнаружении критической уязвимости контракта. Приостановка публикуется с причиной, evidence hash и автоматически истекает через 72 часа.',
      en: 'The Council may urgently suspend an election upon discovering a critical contract vulnerability. Suspension is published with a reason and evidence hash and expires automatically after 72 hours.',
    },
    rationale: {
      ru: 'Отсутствие экстренной процедуры оставляет систему без ответа на критические инциденты.',
      en: 'Lack of an emergency procedure leaves the system without a response to critical incidents.',
    },
  },
  {
    id: 'am-3', documentId: 'doc-monetary', clauseId: 'mp-2', kind: 'change',
    electionId: 'e-103', amendmentHash: '0x6c17be90d4a3',
    proposedText: {
      ru: 'В резервный фонд направляется 15% ежемесячных поступлений. Средства резерва расходуются только по решению Совета, принятому после публичного обсуждения не менее 14 дней.',
      en: 'The reserve fund receives 15% of monthly inflows. Reserve funds are spent only by Council decision taken after at least 14 days of public discussion.',
    },
    rationale: {
      ru: 'Резерв 10% не покрывает волатильность поступлений последних двух кварталов.',
      en: '10% reserve does not cover inflow volatility of the last two quarters.',
    },
  },
  {
    id: 'am-4', documentId: 'doc-monetary', clauseId: 'mp-4', kind: 'change',
    electionId: 'e-104', amendmentHash: '0xf05a19c37b28',
    proposedText: {
      ru: 'Финансовый отчёт публикуется ежемесячно в течение 15 дней после окончания месяца и сопровождается машиночитаемым приложением.',
      en: 'The financial report is published monthly within 15 days after month end, accompanied by a machine-readable annex.',
    },
    rationale: {
      ru: 'Квартальная отчётность запаздывает относительно скорости решений о грантах.',
      en: 'Quarterly reporting lags behind the pace of grant decisions.',
    },
  },
  {
    id: 'am-5', documentId: 'doc-exams', clauseId: 'ex-2', kind: 'change',
    electionId: 'e-105', amendmentHash: '0x3bd80fe6a1c9',
    proposedText: {
      ru: 'Повторная сдача экзамена того же уровня допускается не ранее чем через 7 дней после предыдущей попытки.',
      en: 'A retake of the same-level exam is allowed no earlier than 7 days after the previous attempt.',
    },
    rationale: {
      ru: 'Срок 30 дней избыточен и замедляет рост квалифицированных групп.',
      en: 'The 30-day period is excessive and slows qualified group growth.',
    },
  },
  {
    id: 'am-6', documentId: 'doc-opendata', clauseId: 'od-1', kind: 'change',
    electionId: 'e-106', amendmentHash: '0xa9e2c40d7f51',
    proposedText: {
      ru: 'Снимок голосования публикуется в виде JSON-манифеста в IPFS; on-chain фиксируются хеш манифеста и Merkle root индивидуальных весов.',
      en: 'An election snapshot is published as a JSON manifest on IPFS; the manifest hash and a Merkle root of individual weights are committed on-chain.',
    },
    rationale: {
      ru: 'Merkle root позволяет проверять индивидуальный вес без полного дампа реестра.',
      en: 'A Merkle root allows verifying an individual weight without a full registry dump.',
    },
  },
  {
    // свободная поправка: без активного голосования (для админ-панели)
    id: 'am-8', documentId: 'doc-opendata', clauseId: 'od-2', kind: 'change',
    electionId: '', amendmentHash: '0x59fe12c7d0b4',
    proposedText: {
      ru: 'Индексатор обязан хранить хеши транзакций и sequence numbers событий, публиковать инструменты полного восстановления базы из chain-данных и еженедельный отчёт сверки с fullnode.',
      en: 'The indexer must store transaction hashes and event sequence numbers, publish tools for full database rebuild from chain data, and a weekly fullnode reconciliation report.',
    },
    rationale: {
      ru: 'Возможность восстановления должна быть регулярно доказуемой, а не декларативной.',
      en: 'Rebuild capability must be regularly provable, not declarative.',
    },
  },
  {
    id: 'am-7', documentId: 'doc-forest', clauseId: 'fr-2', kind: 'change',
    electionId: 'e-107', amendmentHash: '0xdd7301b9e845',
    proposedText: {
      ru: 'Участки отбираются по индексу деградации почвы, плотности существующих насаждений и открытому реестру заявок жителей с публичной картой приоритетов.',
      en: 'Sites are selected by soil degradation index, existing canopy density, and an open resident request registry with a public priority map.',
    },
    rationale: {
      ru: 'Текущие критерии не учитывают запросы жителей и распределяют посадки неравномерно.',
      en: 'Current criteria ignore resident requests and distribute planting unevenly.',
    },
  },
]

// ---------- снимки ----------

function makeSnapshot(id: number, electionId: string, categoryId: string, cutoff: string): ElectionSnapshot {
  const cat = categories.find((c) => c.id === categoryId)!
  const counts = groupCounts[categoryId]
  const comp = computeSnapshot(counts, cat.policy)
  return {
    id, electionId, categoryId,
    policyVersion: cat.policy.policyVersion,
    registryVersion: cat.registryVersion,
    registrationCutoff: cutoff,
    groups: comp.groups as ElectionSnapshot['groups'],
    scaleS: comp.scaleS,
    eligibleWeight: comp.eligibleWeight,
    manifestHash: `0x${(id * 2654435761 % 0xffffffff).toString(16).padStart(8, '0')}beef` as `0x${string}`,
  }
}

export const snapshots: ElectionSnapshot[] = [
  makeSnapshot(15, 'e-104', 'c-econ', '2026-05-12T00:00:00Z'),
  makeSnapshot(16, 'e-105', 'c-edu', '2026-05-20T00:00:00Z'),
  makeSnapshot(17, 'e-101', 'c-law', '2026-06-18T00:00:00Z'),
  makeSnapshot(18, 'e-103', 'c-econ', '2026-06-25T00:00:00Z'),
  makeSnapshot(19, 'e-107', 'c-eco', '2026-06-28T00:00:00Z'),
  makeSnapshot(20, 'e-102', 'c-law', '2026-07-01T00:00:00Z'),
  makeSnapshot(21, 'e-106', 'c-tech', '2026-07-09T00:00:00Z'),
]

// ---------- голосования ----------

export const elections: Election[] = [
  {
    id: 'e-101', categoryId: 'c-law', documentId: 'doc-charter', amendmentId: 'am-1',
    title: { ru: 'Порог решений Совета: 2/3 вместо простого большинства', en: 'Council decision threshold: 2/3 instead of simple majority' },
    startsAt: '2026-06-20T10:00:00Z', endsAt: '2026-07-18T10:00:00Z',
    quorumBps: 3000, passBps: 6000, snapshotId: 17, status: 'active', allowRevote: true,
  },
  {
    id: 'e-102', categoryId: 'c-law', documentId: 'doc-charter', amendmentId: 'am-2',
    title: { ru: 'Экстренная приостановка голосования (72 часа)', en: 'Emergency election suspension (72 hours)' },
    startsAt: '2026-07-03T10:00:00Z', endsAt: '2026-07-24T10:00:00Z',
    quorumBps: 3500, passBps: 6600, snapshotId: 20, status: 'active', allowRevote: true,
  },
  {
    id: 'e-103', categoryId: 'c-econ', documentId: 'doc-monetary', amendmentId: 'am-3',
    title: { ru: 'Резервный фонд: 15% и публичное обсуждение', en: 'Reserve fund: 15% with public discussion' },
    startsAt: '2026-06-27T10:00:00Z', endsAt: '2026-07-15T10:00:00Z',
    quorumBps: 2500, passBps: 5000, snapshotId: 18, status: 'active', allowRevote: true,
  },
  {
    id: 'e-104', categoryId: 'c-econ', documentId: 'doc-monetary', amendmentId: 'am-4',
    title: { ru: 'Ежемесячная финансовая отчётность', en: 'Monthly financial reporting' },
    startsAt: '2026-05-14T10:00:00Z', endsAt: '2026-06-04T10:00:00Z',
    quorumBps: 2500, passBps: 5000, snapshotId: 15, status: 'passed', allowRevote: true,
  },
  {
    id: 'e-105', categoryId: 'c-edu', documentId: 'doc-exams', amendmentId: 'am-5',
    title: { ru: 'Сокращение срока пересдачи до 7 дней', en: 'Reduce retake period to 7 days' },
    startsAt: '2026-05-22T10:00:00Z', endsAt: '2026-06-12T10:00:00Z',
    quorumBps: 3000, passBps: 5000, snapshotId: 16, status: 'rejected', allowRevote: true,
  },
  {
    id: 'e-106', categoryId: 'c-tech', documentId: 'doc-opendata', amendmentId: 'am-6',
    title: { ru: 'Merkle root индивидуальных весов в снимке', en: 'Merkle root of individual weights in snapshot' },
    startsAt: '2026-07-14T10:00:00Z', endsAt: '2026-08-04T10:00:00Z',
    quorumBps: 3000, passBps: 5000, snapshotId: 21, status: 'upcoming', allowRevote: true,
  },
  {
    id: 'e-107', categoryId: 'c-eco', documentId: 'doc-forest', amendmentId: 'am-7',
    title: { ru: 'Открытый реестр заявок жителей в критериях участков', en: 'Open resident request registry in site criteria' },
    startsAt: '2026-06-30T10:00:00Z', endsAt: '2026-07-21T10:00:00Z',
    quorumBps: 2500, passBps: 5000, snapshotId: 19, status: 'active', allowRevote: true,
  },
]

// ---------- голоса и итоги ----------

export const votes: Vote[] = [
  {
    electionId: 'e-101', voter: '0xc0de9128fa03', weight: 6.25,
    current: { revision: 1, at: '2026-06-22T14:03:00Z', yesBps: 10000, noBps: 0, abstainBps: 0, txHash: '0x7d02e4b1a9f3' },
    history: [],
  },
  {
    electionId: 'e-103', voter: '0xbeef5501ac77', weight: 19.6,
    current: { revision: 2, at: '2026-07-02T09:41:00Z', yesBps: 7000, noBps: 2000, abstainBps: 1000, txHash: '0x4bd91c3ea07f' },
    history: [
      { revision: 1, at: '2026-06-28T11:15:00Z', yesBps: 5000, noBps: 5000, abstainBps: 0, txHash: '0x2a80fe57c1d4' },
    ],
  },
  {
    electionId: 'e-103', voter: '0xf00d3c67e421', weight: 1,
    current: { revision: 1, at: '2026-06-29T18:22:00Z', yesBps: 0, noBps: 10000, abstainBps: 0, txHash: '0x90c3ab72e5d1' },
    history: [],
  },
  {
    electionId: 'e-107', voter: '0xe5e57a3d9b11', weight: 2.81,
    current: { revision: 1, at: '2026-07-01T08:05:00Z', yesBps: 10000, noBps: 0, abstainBps: 0, txHash: '0x6e51fd08b32a' },
    history: [],
  },
]

// стартовые агрегаты (включают голоса «за кадром» помимо списка выше)
export const tallies: Record<string, Tally> = {
  'e-101': { yes: 38.4, no: 12.1, abstain: 6.3, turnoutWeight: 56.8 },
  'e-102': { yes: 21.0, no: 17.5, abstain: 4.0, turnoutWeight: 42.5 },
  'e-103': { yes: 61.3, no: 22.6, abstain: 8.1, turnoutWeight: 92.0 },
  'e-104': { yes: 148.9, no: 66.2, abstain: 21.4, turnoutWeight: 236.5 },
  'e-105': { yes: 60.1, no: 74.3, abstain: 12.2, turnoutWeight: 146.6 },
  'e-106': { yes: 0, no: 0, abstain: 0, turnoutWeight: 0 },
  'e-107': { yes: 30.2, no: 9.8, abstain: 3.5, turnoutWeight: 43.5 },
}

export const receipts: Receipt[] = [
  {
    id: 'r-88', electionId: 'e-104', voter: ME, txHash: '0x5f13cc07ad92',
    at: '2026-05-18T12:30:00Z', snapshotId: 15,
  },
]

export const myPastVotes: Vote[] = [
  {
    electionId: 'e-104', voter: ME, weight: 7,
    current: { revision: 1, at: '2026-05-18T12:30:00Z', yesBps: 10000, noBps: 0, abstainBps: 0, txHash: '0x5f13cc07ad92' },
    history: [],
  },
]

// ---------- экзамены ----------

const legacyExams: Array<Omit<Exam, 'version' | 'items' | 'sources'> & { questions: ExamQuestion[] }> = [
  {
    id: 'x-econ-3', categoryId: 'c-econ', targetLevel: 3, minutes: 25, passShare: 0.8,
    title: { ru: 'Экономика: экспертный уровень L3', en: 'Economics: expert level L3' },
    questions: [
      {
        q: { ru: 'Что фиксирует registration cutoff перед голосованием?', en: 'What does the registration cutoff freeze before an election?' },
        options: [
          { ru: 'Список допущенных, уровни, квоты и веса', en: 'Admitted list, levels, quotas and weights' },
          { ru: 'Только итоговый результат', en: 'Only the final result' },
          { ru: 'Список транзакций индексатора', en: 'Indexer transaction list' },
        ],
        correct: 0,
      },
      {
        q: { ru: 'Почему Nk — это допущенные аккаунты, а не проголосовавшие?', en: 'Why is Nk admitted accounts, not actual voters?' },
        options: [
          { ru: 'Чтобы вес не менялся по ходу голосования', en: 'So weight does not change during the election' },
          { ru: 'Для экономии газа', en: 'To save gas' },
          { ru: 'Это требование кошелька', en: 'A wallet requirement' },
        ],
        correct: 0,
      },
      {
        q: { ru: 'При q=[25,15,25,35]% и N0=70 чему равен масштаб S?', en: 'With q=[25,15,25,35]% and N0=70, what is scale S?' },
        options: [
          { ru: '280', en: '280' },
          { ru: '70', en: '70' },
          { ru: '175', en: '175' },
        ],
        correct: 0,
      },
      {
        q: { ru: 'Что происходит при Fk > Tk (overload) в MVP?', en: 'What happens on Fk > Tk (overload) in the MVP?' },
        options: [
          { ru: 'Снимок отклоняется', en: 'Snapshot is rejected' },
          { ru: 'Квота перераспределяется', en: 'Quota is redistributed' },
          { ru: 'Вес обнуляется', en: 'Weight is zeroed' },
        ],
        correct: 0,
      },
      {
        q: { ru: 'Входит ли воздержание в явку кворума?', en: 'Does abstention count toward quorum turnout?' },
        options: [
          { ru: 'Да, но не в знаменатель большинства', en: 'Yes, but not in the majority denominator' },
          { ru: 'Нет, никогда', en: 'No, never' },
          { ru: 'Только при кворуме ниже 25%', en: 'Only when quorum is below 25%' },
        ],
        correct: 0,
      },
    ],
  },
  {
    id: 'x-tech-2', categoryId: 'c-tech', targetLevel: 2, minutes: 20, passShare: 0.75,
    title: { ru: 'Технологии: продвинутый уровень L2', en: 'Technology: advanced level L2' },
    questions: [
      {
        q: { ru: 'Где должны находиться приватные ключи relayer?', en: 'Where must relayer private keys live?' },
        options: [
          { ru: 'Только на backend', en: 'Backend only' },
          { ru: 'В localStorage браузера', en: 'In browser localStorage' },
          { ru: 'В env-переменных Vite', en: 'In Vite env vars' },
        ],
        correct: 0,
      },
      {
        q: { ru: 'Зачем relayer-запросам clientRequestId?', en: 'Why do relayer requests need a clientRequestId?' },
        options: [
          { ru: 'Идемпотентность при повторе на mobile', en: 'Idempotency for mobile retries' },
          { ru: 'Для аналитики', en: 'For analytics' },
          { ru: 'Для сортировки логов', en: 'For log sorting' },
        ],
        correct: 0,
      },
      {
        q: { ru: 'Может ли индексатор быть единственным источником доказательств?', en: 'Can the indexer be the only proof source?' },
        options: [
          { ru: 'Нет, записи должны проверяться по chain-ссылкам', en: 'No, records must be checkable via chain references' },
          { ru: 'Да, если база реплицирована', en: 'Yes, if the DB is replicated' },
          { ru: 'Да, при HTTPS', en: 'Yes, with HTTPS' },
        ],
        correct: 0,
      },
      {
        q: { ru: 'Что хранится on-chain для документа?', en: 'What is stored on-chain for a document?' },
        options: [
          { ru: 'Хеш и URI метаданных', en: 'Hash and metadata URI' },
          { ru: 'Полный текст', en: 'Full text' },
          { ru: 'PDF-файл', en: 'A PDF file' },
        ],
        correct: 0,
      },
    ],
  },
  {
    id: 'x-law-1', categoryId: 'c-law', targetLevel: 1, minutes: 15, passShare: 0.7,
    title: { ru: 'Право: базовый уровень L1', en: 'Law: basic level L1' },
    questions: [
      {
        q: { ru: 'Сколько активных голосований может иметь один amendment?', en: 'How many active elections can one amendment have?' },
        options: [
          { ru: 'Ровно одно', en: 'Exactly one' },
          { ru: 'Не более трёх', en: 'Up to three' },
          { ru: 'Без ограничений', en: 'Unlimited' },
        ],
        correct: 0,
      },
      {
        q: { ru: 'Что делает переголосование с предыдущей ревизией?', en: 'What does a revote do with the previous revision?' },
        options: [
          { ru: 'Заменяет вклад, но ревизия остаётся в аудите', en: 'Replaces the tally, revision stays in audit' },
          { ru: 'Полностью удаляет её', en: 'Deletes it entirely' },
          { ru: 'Блокирует аккаунт', en: 'Locks the account' },
        ],
        correct: 0,
      },
      {
        q: { ru: 'Порог решений при одном администраторе?', en: 'Decision threshold with a single administrator?' },
        options: [
          { ru: '1/1', en: '1/1' },
          { ru: '2/3', en: '2/3' },
          { ru: 'Решения невозможны', en: 'Decisions are impossible' },
        ],
        correct: 0,
      },
    ],
  },
  {
    id: 'x-eco-1', categoryId: 'c-eco', targetLevel: 1, minutes: 15, passShare: 0.7,
    title: { ru: 'Экология: базовый уровень L1', en: 'Ecology: basic level L1' },
    questions: [
      {
        q: { ru: 'Экзамен обещает фиксированную прибавку веса?', en: 'Does an exam promise a fixed weight bonus?' },
        options: [
          { ru: 'Нет, только предложение нового уровня', en: 'No, only a new level proposal' },
          { ru: 'Да, +18.5', en: 'Yes, +18.5' },
          { ru: 'Да, удвоение', en: 'Yes, doubling' },
        ],
        correct: 0,
      },
      {
        q: { ru: 'Когда новый уровень влияет на вес?', en: 'When does a new level affect weight?' },
        options: [
          { ru: 'В голосованиях со снимком после revision', en: 'In elections snapshotted after the revision' },
          { ru: 'Немедленно во всех', en: 'Immediately everywhere' },
          { ru: 'Через 24 часа', en: 'After 24 hours' },
        ],
        correct: 0,
      },
      {
        q: { ru: 'Кто подтверждает результат экзамена?', en: 'Who confirms an exam result?' },
        options: [
          { ru: 'Администраторы (N из M)', en: 'Administrators (N of M)' },
          { ru: 'Автор экзамена', en: 'The exam author' },
          { ru: 'Индексатор', en: 'The indexer' },
        ],
        correct: 0,
      },
    ],
  },
  {
    id: 'x-edu-1', categoryId: 'c-edu', targetLevel: 1, minutes: 15, passShare: 0.7,
    title: { ru: 'Образование: базовый уровень L1', en: 'Education: basic level L1' },
    questions: [
      {
        q: { ru: 'Что такое evidence hash в квалификации?', en: 'What is the evidence hash in a qualification?' },
        options: [
          { ru: 'Хеш доказательства (результат экзамена, причина)', en: 'Hash of the evidence (exam result, reason)' },
          { ru: 'Пароль администратора', en: 'Administrator password' },
          { ru: 'Приватный ключ', en: 'A private key' },
        ],
        correct: 0,
      },
      {
        q: { ru: 'Видна ли история изменений уровня публично?', en: 'Is level change history publicly visible?' },
        options: [
          { ru: 'Да, все ревизии публичны', en: 'Yes, all revisions are public' },
          { ru: 'Нет, только владельцу', en: 'No, owner only' },
          { ru: 'Только администраторам', en: 'Admins only' },
        ],
        correct: 0,
      },
      {
        q: { ru: 'Может ли уровень деградировать со временем?', en: 'Can a level degrade over time?' },
        options: [
          { ru: 'Да, по дате подтверждения конкретного человека', en: 'Yes, by the person’s confirmation date' },
          { ru: 'Нет, уровень вечен', en: 'No, levels are permanent' },
          { ru: 'Только по решению суда', en: 'Only by court decision' },
        ],
        correct: 0,
      },
    ],
  },
]

void legacyExams
export const exams: Exam[] = examCatalog

export const attempts: ExamAttempt[] = [
  {
    id: 'at-12', examId: 'x-tech-2', voter: '0x9a7b44f10c55', at: '2026-07-08T15:40:00Z',
    scoreShare: 1, status: 'passed_pending_admin', evidenceHash: '0x1dc4f2a07be9',
  },
]

// ---------- аудит ----------

export const auditEvents: AuditEvent[] = [
  {
    id: 'ae-1', type: 'election_created', at: '2026-07-03T09:58:00Z', actor: '0xad0173bb41e0',
    categoryId: 'c-law', electionId: 'e-102', snapshotId: 20, txHash: '0xb810c34fd5e2',
    human: { ru: 'Создано голосование e-102 по поправке am-2 (снимок #20)', en: 'Election e-102 created for amendment am-2 (snapshot #20)' },
  },
  {
    id: 'ae-2', type: 'snapshot', at: '2026-07-01T00:00:00Z', actor: '0xad0173bb41e0',
    categoryId: 'c-law', electionId: 'e-102', snapshotId: 20, txHash: '0x3c5fe1a98d07',
    human: { ru: 'Зафиксирован снимок #20: 83 аккаунта, суммарный вес 200', en: 'Snapshot #20 frozen: 83 accounts, total weight 200' },
  },
  {
    id: 'ae-3', type: 'revote', at: '2026-07-02T09:41:00Z', actor: '0xbeef5501ac77',
    categoryId: 'c-econ', electionId: 'e-103', txHash: '0x4bd91c3ea07f',
    human: { ru: 'Переголосование в e-103: 70/20/10 (ревизия 2 заменила ревизию 1)', en: 'Revote in e-103: 70/20/10 (revision 2 replaced revision 1)' },
  },
  {
    id: 'ae-4', type: 'vote', at: '2026-07-01T08:05:00Z', actor: '0xe5e57a3d9b11',
    categoryId: 'c-eco', electionId: 'e-107', txHash: '0x6e51fd08b32a',
    human: { ru: 'Голос в e-107: 100% за, вес 2.81', en: 'Vote in e-107: 100% yes, weight 2.81' },
  },
  {
    id: 'ae-5', type: 'qualification', at: '2026-05-03T10:12:00Z', actor: '0xad0173bb41e0',
    categoryId: 'c-econ', txHash: '0x8f27ac05de13',
    human: { ru: 'Уровень 0xa11c…97f3 в «Экономике» повышен до L2 (revision #41)', en: 'Level of 0xa11c…97f3 in Economics raised to L2 (revision #41)' },
  },
  {
    id: 'ae-6', type: 'policy', at: '2026-06-10T13:00:00Z', actor: '0xad0173bb41e0',
    categoryId: 'c-econ', txHash: '0xc47a90bd21e6',
    human: { ru: 'Политика «Экономики» v4: квоты 25/15/25/35, cap 25', en: 'Economics policy v4: quotas 25/15/25/35, cap 25' },
  },
  {
    id: 'ae-7', type: 'receipt', at: '2026-05-18T12:30:00Z', actor: ME,
    categoryId: 'c-econ', electionId: 'e-104', txHash: '0x5f13cc07ad92',
    human: { ru: 'Receipt r-88 подтверждает голос в e-104 (100% за, вес 7)', en: 'Receipt r-88 proves the vote in e-104 (100% yes, weight 7)' },
  },
  {
    id: 'ae-8', type: 'finalized', at: '2026-06-04T10:00:05Z', actor: '0xad0173bb41e0',
    categoryId: 'c-econ', electionId: 'e-104', txHash: '0xe93b57a10cd4',
    human: { ru: 'Голосование e-104 финализировано: принято (69% за при кворуме 84%)', en: 'Election e-104 finalized: passed (69% yes at 84% quorum)' },
  },
  {
    id: 'ae-9', type: 'finalized', at: '2026-06-12T10:00:04Z', actor: '0xad0173bb41e0',
    categoryId: 'c-edu', electionId: 'e-105', txHash: '0x02df6c48b9a1',
    human: { ru: 'Голосование e-105 финализировано: отклонено (45% за)', en: 'Election e-105 finalized: rejected (45% yes)' },
  },
  {
    id: 'ae-10', type: 'admin', at: '2026-04-02T09:00:00Z', actor: '0xad0173bb41e0',
    txHash: '0x76e0d1fb3a28',
    human: { ru: 'Подтверждена регистрация 9 новых аккаунтов категории «Экология»', en: 'Registration of 9 new Ecology accounts confirmed' },
  },
  {
    id: 'ae-11', type: 'vote', at: '2026-06-29T18:22:00Z', actor: '0xf00d3c67e421',
    categoryId: 'c-econ', electionId: 'e-103', txHash: '0x90c3ab72e5d1',
    human: { ru: 'Голос в e-103: 100% против, вес 1', en: 'Vote in e-103: 100% no, weight 1' },
  },
  {
    id: 'ae-12', type: 'vote', at: '2026-06-22T14:03:00Z', actor: '0xc0de9128fa03',
    categoryId: 'c-law', electionId: 'e-101', txHash: '0x7d02e4b1a9f3',
    human: { ru: 'Голос в e-101: 100% за, вес 6.25', en: 'Vote in e-101: 100% yes, weight 6.25' },
  },
  {
    id: 'ae-13', type: 'qualification', at: '2026-04-28T16:45:00Z', actor: '0xad0173bb41e0',
    categoryId: 'c-econ', txHash: '0x33b8e2df90ca',
    human: { ru: 'Уровень 0xbeef…ac77 в «Экономике» повышен до L3 (revision #40)', en: 'Level of 0xbeef…ac77 in Economics raised to L3 (revision #40)' },
  },
  {
    id: 'ae-14', type: 'vote', at: '2026-07-09T21:10:00Z', actor: '0xd00d81b2c9ee',
    categoryId: 'c-law', electionId: 'e-101', txHash: '0xa5c208fe61d9',
    human: { ru: 'Голос в e-101: 60% за / 40% против, вес 1', en: 'Vote in e-101: 60% yes / 40% no, weight 1' },
  },
]

export const groupNames: Record<string, { ru: string; en: string }> = {
  charter: { ru: 'Уставные документы', en: 'Charter documents' },
  policy: { ru: 'Экономическая политика', en: 'Economic policy' },
  regulation: { ru: 'Регламенты', en: 'Regulations' },
  standard: { ru: 'Технические стандарты', en: 'Technical standards' },
  program: { ru: 'Программы', en: 'Programs' },
}

export const groupColors: Record<string, string> = {
  charter: '#7B5EA7',
  policy: '#E64232',
  regulation: '#EFB31E',
  standard: '#00A9BD',
  program: '#679B1E',
}
