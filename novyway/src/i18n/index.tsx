/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext } from 'react'

export type Lang = 'ru' | 'en'
export type LStr = { ru: string; en: string }

const dict = {
  // навигация
  'nav.overview': { ru: 'Обзор', en: 'Overview' },
  'nav.elections': { ru: 'Голосования', en: 'Elections' },
  'nav.documents': { ru: 'Документы', en: 'Documents' },
  'nav.graph': { ru: 'Граф', en: 'Graph' },
  'nav.game': { ru: 'Сигнал', en: 'Signal' },
  'nav.more': { ru: 'Ещё', en: 'More' },
  'nav.profile': { ru: 'Кабинет', en: 'Profile' },
  'nav.exams': { ru: 'Экзамены', en: 'Exams' },
  'nav.audit': { ru: 'Аудит', en: 'Audit' },
  'nav.admin': { ru: 'Управление', en: 'Admin' },
  'nav.settings': { ru: 'Настройки', en: 'Settings' },
  'nav.categories': { ru: 'Категории', en: 'Categories' },
  'nav.main': { ru: 'Рабочие разделы', en: 'Workspaces' },
  'nav.service': { ru: 'Служебные', en: 'Service' },
  'nav.collapse': { ru: 'Свернуть панель', en: 'Collapse sidebar' },
  'nav.expand': { ru: 'Развернуть панель', en: 'Expand sidebar' },

  // общее
  'common.demo': { ru: 'Демонстрация · без блокчейна', en: 'Demo mode · no blockchain' },
  'common.network': { ru: 'Сеть', en: 'Network' },
  'common.policy': { ru: 'правила', en: 'policy' },
  'common.snapshot': { ru: 'Снимок', en: 'Snapshot' },
  'common.deadline': { ru: 'Срок', en: 'Deadline' },
  'common.quorum': { ru: 'Кворум', en: 'Quorum' },
  'common.support': { ru: 'Поддержка', en: 'Support' },
  'common.turnout': { ru: 'Явка', en: 'Turnout' },
  'common.status': { ru: 'Статус', en: 'Status' },
  'common.category': { ru: 'Категория', en: 'Category' },
  'common.document': { ru: 'Документ', en: 'Document' },
  'common.clause': { ru: 'Пункт', en: 'Clause' },
  'common.level': { ru: 'Уровень', en: 'Level' },
  'common.weight': { ru: 'Вес', en: 'Weight' },
  'common.open': { ru: 'Открыть', en: 'Open' },
  'common.all': { ru: 'Все', en: 'All' },
  'common.search': { ru: 'Поиск', en: 'Search' },
  'common.date': { ru: 'Дата', en: 'Date' },
  'common.actor': { ru: 'Участник', en: 'Actor' },
  'common.event': { ru: 'Событие', en: 'Event' },
  'common.yes': { ru: 'За', en: 'Yes' },
  'common.no': { ru: 'Против', en: 'No' },
  'common.abstain': { ru: 'Воздержание', en: 'Abstain' },
  'common.days': { ru: 'дн.', en: 'd' },
  'common.mute': { ru: 'Звук выключен', en: 'Sound off' },
  'common.unmute': { ru: 'Звук включён', en: 'Sound on' },
  'common.notRegistered': { ru: 'не зарегистрирован', en: 'not registered' },
  'common.you': { ru: 'вы', en: 'you' },
  'common.admin': { ru: 'администратор', en: 'admin' },
  'common.back': { ru: 'Назад', en: 'Back' },
  'common.save': { ru: 'Сохранить', en: 'Save' },
  'common.cancel': { ru: 'Отмена', en: 'Cancel' },
  'common.accounts': { ru: 'учётных записей', en: 'accounts' },
  'common.edit': { ru: 'Изменить', en: 'Edit' },
  'common.close': { ru: 'Закрыть', en: 'Close' },

  // гражданский скор и вход (июль 2026)
  'sc.title': { ru: 'Гражданский рейтинг', en: 'Civic score' },
  'sc.hint': { ru: 'голос +25 · документ +15 · экзамен +20', en: 'vote +25 · document +15 · exam +20' },
  'sc.rank0': { ru: 'Путь только начинается', en: 'The path just begins' },
  'sc.rank1': { ru: 'Активный участник', en: 'Active participant' },
  'sc.rank2': { ru: 'Опора сообщества', en: 'Pillar of the community' },
  'sc.badgeVoter': { ru: 'Избиратель', en: 'Voter' },
  'sc.badgeReader': { ru: 'Читатель', en: 'Reader' },
  'sc.badgeArchivist': { ru: 'Архивист', en: 'Archivist' },
  'sc.badgeExpert': { ru: 'Эксперт', en: 'Expert' },
  'sc.readChip': { ru: '+15 к скору · прочитан', en: '+15 score · read' },
  'sc.votes': { ru: 'голосов', en: 'votes' },
  'sc.docs': { ru: 'документов', en: 'documents' },
  'sc.exams': { ru: 'экзаменов', en: 'exams' },
  'sc.local': { ru: 'Скор хранится только на этом устройстве и не публикуется в сети.', en: 'The score is stored on this device only and never published on-chain.' },
  'auth.title': { ru: 'Способы входа', en: 'Sign-in methods' },
  'auth.hint': { ru: 'в демо вход имитируется локально', en: 'in the demo, sign-in is simulated locally' },
  'auth.google': { ru: 'Войти через Google', en: 'Sign in with Google' },
  'auth.apple': { ru: 'Войти через Apple', en: 'Sign in with Apple' },
  'auth.telegram': { ru: 'Войти через Telegram', en: 'Sign in with Telegram' },
  'auth.wallet': { ru: 'Aptos-кошелёк', en: 'Aptos wallet' },
  'auth.connected': { ru: 'Подключено', en: 'Connected' },
  'auth.connecting': { ru: 'Подключаем…', en: 'Connecting…' },
  'auth.signOut': { ru: 'Выйти', en: 'Sign out' },
  'auth.signIn': { ru: 'Войти', en: 'Sign in' },
  'auth.toastIn': { ru: 'Вход выполнен', en: 'Signed in' },
  'auth.toastOut': { ru: 'Вы вышли из аккаунта', en: 'Signed out' },
  'el.verdictPassed': { ru: 'Решение принято', en: 'Decision passed' },
  'el.verdictRejected': { ru: 'Решение отклонено', en: 'Decision rejected' },
  'el.verdictNoQuorum': { ru: 'Кворум не собран', en: 'Quorum not met' },
  'el.left': { ru: 'осталось', en: 'left' },
  'el.closed': { ru: 'окно закрыто', en: 'window closed' },

  // статусы голосований

  'st.active': { ru: 'Идёт', en: 'Active' },
  'st.upcoming': { ru: 'Скоро', en: 'Upcoming' },
  'st.passed': { ru: 'Принято', en: 'Passed' },
  'st.rejected': { ru: 'Отклонено', en: 'Rejected' },
  'st.quorum_failed': { ru: 'Нет кворума', en: 'No quorum' },
  'st.voted': { ru: 'Вы проголосовали', en: 'You voted' },
  'st.notVoted': { ru: 'Голос не подан', en: 'Not voted' },

  // обзор
  'ov.title': { ru: 'Обзор', en: 'Overview' },
  'ov.sub': {
    ru: 'Операционная панель: активные решения, ваши уровни и состояние сети',
    en: 'Operations panel: active decisions, your levels, and network state',
  },
  'ov.activeElections': { ru: 'Активные голосования', en: 'Active elections' },
  'ov.myLevels': { ru: 'Мои уровни по категориям', en: 'My levels by category' },
  'ov.recentEvents': { ru: 'Последние события', en: 'Recent events' },
  'ov.networkState': { ru: 'Состояние сети', en: 'Network state' },
  'ov.graphEntry': { ru: 'Пространство документов', en: 'Document space' },
  'ov.graphEntryHint': {
    ru: '3D-карта документов, поправок, снимков и решений',
    en: '3D map of documents, amendments, snapshots and decisions',
  },
  'ov.openGraph': { ru: 'Открыть граф', en: 'Open graph' },
  'ov.indexer': { ru: 'Индексатор', en: 'Indexer' },
  'ov.contract': { ru: 'Модуль', en: 'Module' },
  'ov.fresh': { ru: 'синхронизирован', en: 'in sync' },
  'ov.upcomingExams': { ru: 'Доступные экзамены', en: 'Available exams' },
  'ov.yourAction': { ru: 'Требуется ваш голос', en: 'Your vote is needed' },

  // голосования
  'el.title': { ru: 'Реестр голосований', en: 'Election registry' },
  'el.sub': {
    ru: 'Каждое решение — один точный пункт одного документа',
    en: 'Each decision is one exact clause of one document',
  },
  'el.myVote': { ru: 'Мой голос', en: 'My vote' },
  'el.ballot': { ru: 'Дробный бюллетень', en: 'Fractional ballot' },
  'el.ballotHint': {
    ru: 'Распределите 100% вашего веса между тремя вариантами',
    en: 'Distribute 100% of your weight across three options',
  },
  'el.presets': { ru: 'Пресеты', en: 'Presets' },
  'el.preset100yes': { ru: '100% за', en: '100% yes' },
  'el.preset5050': { ru: '50 / 50', en: '50 / 50' },
  'el.preset100abs': { ru: '100% воздержание', en: '100% abstain' },
  'el.cast': { ru: 'Подписать и отправить', en: 'Sign and submit' },
  'el.recast': { ru: 'Переголосовать', en: 'Revote' },
  'el.whyWeight': { ru: 'Почему мой вес такой', en: 'Why is my weight this' },
  'el.results': { ru: 'Результат и доказательства', en: 'Result and proofs' },
  'el.amendmentBlock': { ru: 'Предмет решения', en: 'Decision subject' },
  'el.currentText': { ru: 'Действующая редакция', en: 'Current text' },
  'el.proposedText': { ru: 'Предлагаемая редакция', en: 'Proposed text' },
  'el.rationale': { ru: 'Обоснование', en: 'Rationale' },
  'el.openDocument': { ru: 'Открыть полный документ', en: 'Open full document' },
  'el.receipt': { ru: 'Ваша квитанция', en: 'Your receipt' },
  'el.receiptHint': {
    ru: 'Публичное доказательство вашего голоса. Переголосование заменит вклад, но эта ревизия останется в аудите.',
    en: 'Public proof of your vote. A revote replaces the tally, but this revision stays in the audit.',
  },
  'el.contribution': { ru: 'Ваш вклад', en: 'Your contribution' },
  'el.groups': { ru: 'Распределение групп в снимке', en: 'Group distribution in snapshot' },
  'el.revisions': { ru: 'Ревизии голоса', en: 'Vote revisions' },
  'el.notEligible': {
    ru: 'Вы не входите в снимок этого голосования. Уровень, полученный после cutoff, действует только в следующих голосованиях.',
    en: 'You are not in this election’s snapshot. A level obtained after the cutoff applies only to future elections.',
  },
  'el.majority': { ru: 'Большинство', en: 'Majority' },
  'el.needed': { ru: 'порог', en: 'threshold' },
  'el.quorumOf': { ru: 'от допустимого веса', en: 'of eligible weight' },
  'el.voteAccount': { ru: 'Голосующий аккаунт', en: 'Voting account' },

  // документы
  'doc.title': { ru: 'Документы', en: 'Documents' },
  'doc.sub': {
    ru: 'Полные тексты с подсвеченными изменяемыми пунктами',
    en: 'Full texts with highlighted clauses under change',
  },
  'doc.showNew': { ru: 'Новая редакция', en: 'New edition' },
  'doc.showNewHint': {
    ru: 'Показать документ с применёнными поправками',
    en: 'Show the document with amendments applied',
  },
  'doc.changed': { ru: 'изменяется', en: 'changing' },
  'doc.added': { ru: 'новый пункт', en: 'new clause' },
  'doc.hoverHint': {
    ru: 'Красным подсвечены пункты с активными поправками. Наведите или коснитесь, чтобы увидеть предлагаемый текст; клик открывает бюллетень.',
    en: 'Clauses with active amendments are highlighted in red. Hover or tap to preview the proposed text; click opens the ballot.',
  },
  'doc.willReplace': { ru: 'Будет заменено на', en: 'Will be replaced with' },
  'doc.election': { ru: 'Голосование', en: 'Election' },
  'doc.version': { ru: 'версия', en: 'version' },
  'doc.hash': { ru: 'хеш', en: 'hash' },
  'doc.amendments': { ru: 'поправок на голосовании', en: 'amendments in vote' },
  'doc.group': { ru: 'Группа', en: 'Group' },
  'doc.workspace': { ru: 'Документы и связи', en: 'Documents and relations' },
  'doc.workspaceSub': { ru: 'Один реестр в виде списка, графа или совмещённого пространства', en: 'One registry as a list, graph, or combined workspace' },
  'doc.combinedView': { ru: 'Совмещённый', en: 'Combined' },
  'doc.primaryTopic': { ru: 'Главная тема', en: 'Primary topic' },
  'doc.secondaryTopics': { ru: 'Дополнительные темы', en: 'Secondary topics' },
  'doc.sort': { ru: 'Сортировка', en: 'Sort' },
  'doc.newest': { ru: 'Сначала новые', en: 'Newest first' },
  'doc.oldest': { ru: 'Сначала старые', en: 'Oldest first' },
  'doc.nameSort': { ru: 'По названию', en: 'By title' },
  'doc.activeOnly': { ru: 'Только с активным голосованием', en: 'Active votes only' },
  'doc.graphSpace': { ru: 'Пространство графа', en: 'Graph space' },

  // профиль
  'pr.title': { ru: 'Личный кабинет', en: 'Personal profile' },
  'pr.sub': {
    ru: 'Ваши уровни, веса, голоса и публичные доказательства',
    en: 'Your levels, weights, votes and public proofs',
  },
  'pr.address': { ru: 'Публичный адрес голосования', en: 'Public voting address' },
  'pr.myQuals': { ru: 'Квалификации', en: 'Qualifications' },
  'pr.confirmed': { ru: 'подтверждено', en: 'confirmed' },
  'pr.evidence': { ru: 'Evidence', en: 'Evidence' },
  'pr.votes': { ru: 'Мои голоса', en: 'My votes' },
  'pr.receipts': { ru: 'Квитанции', en: 'Receipts' },
  'pr.pendingExams': { ru: 'Экзамены на подтверждении', en: 'Exams awaiting confirmation' },
  'pr.noVotes': { ru: 'Голосов пока нет', en: 'No votes yet' },
  'pr.role': { ru: 'Роль', en: 'Role' },
  'pr.registered': { ru: 'Зарегистрирован', en: 'Registered' },
  'pr.identity': { ru: 'Личность в реестре', en: 'Registry identity' },
  'pr.editProfile': { ru: 'Редактировать профиль', en: 'Edit profile' },
  'pr.name': { ru: 'Имя', en: 'Name' },
  'pr.email': { ru: 'Почта', en: 'Email' },
  'pr.telegram': { ru: 'Telegram', en: 'Telegram' },
  'pr.openExams': { ru: 'Перейти к экзаменам', en: 'Open exams' },

  // экзамены
  'xm.title': { ru: 'Экзамены', en: 'Exams' },
  'xm.sub': {
    ru: 'Экзамен предлагает новый уровень — итоговый вес зависит от квоты и состава будущего снимка',
    en: 'An exam proposes a new level — final weight depends on quota and future snapshot composition',
  },
  'xm.target': { ru: 'Целевой уровень', en: 'Target level' },
  'xm.pass': { ru: 'Проходной балл', en: 'Pass score' },
  'xm.minutes': { ru: 'мин', en: 'min' },
  'xm.start': { ru: 'Начать экзамен', en: 'Start exam' },
  'xm.submit': { ru: 'Завершить экзамен', en: 'Finish exam' },
  'xm.q': { ru: 'Вопрос', en: 'Question' },
  'xm.passed': {
    ru: 'Экзамен сдан. Результат отправлен администраторам на подтверждение.',
    en: 'Exam passed. The result was sent to administrators for confirmation.',
  },
  'xm.failed': { ru: 'Экзамен не сдан. Повторная попытка — через 30 дней.', en: 'Exam failed. Retake available in 30 days.' },
  'xm.pendingNote': {
    ru: 'Новый уровень будет использован только в голосованиях, снимок которых создан после подтверждения.',
    en: 'The new level will be used only in elections snapshotted after confirmation.',
  },
  'xm.yourScore': { ru: 'Ваш результат', en: 'Your score' },
  'xm.currentLevel': { ru: 'Текущий уровень', en: 'Current level' },

  // аудит
  'au.title': { ru: 'Аудит', en: 'Audit' },
  'au.sub': {
    ru: 'Публичный журнал: человеческое описание рядом с raw proof',
    en: 'Public log: human description next to the raw proof',
  },
  'au.identityMode': { ru: 'Показывать личности', en: 'Show identities' },
  'au.identityHint': {
    ru: 'Адреса кошельков заменяются именами из реестра личностей, если участник зарегистрирован на платформе',
    en: 'Wallet addresses are replaced with registry names when the participant is registered on the platform',
  },
  'au.searchPh': { ru: 'Адрес, election id, tx hash…', en: 'Address, election id, tx hash…' },
  'au.type': { ru: 'Тип', en: 'Type' },
  'au.proof': { ru: 'Доказательство', en: 'Proof' },
  'au.empty': { ru: 'Ничего не найдено по запросу', en: 'Nothing found for the query' },

  // граф
  'gr.title': { ru: 'Пространство документов', en: 'Document space' },
  'gr.searchPh': { ru: 'Найти узел…', en: 'Find node…' },
  'gr.center': { ru: 'Центрировать', en: 'Center' },
  'gr.reset': { ru: 'Сбросить вид', en: 'Reset view' },
  'gr.listView': { ru: 'Список', en: 'List' },
  'gr.3dView': { ru: '3D', en: '3D' },
  'gr.inspector': { ru: 'Инспектор', en: 'Inspector' },
  'gr.openNode': { ru: 'Открыть страницу', en: 'Open page' },
  'gr.connections': { ru: 'Связи', en: 'Connections' },
  'gr.legendHint': { ru: 'Цвет узла = группа документов / категория', en: 'Node color = document group / category' },
  'gr.nodes': { ru: 'узлов', en: 'nodes' },
  'gr.drag': { ru: 'Вращение — перетаскивание · масштаб — колесо/щипок', en: 'Drag to rotate · wheel/pinch to zoom' },
  'gr.activeVote': { ru: 'Идёт голосование', en: 'Voting active' },
  'gr.historicalVote': { ru: 'Есть история голосований', en: 'Voting history' },
  'gr.shapeHint': { ru: 'Форма показывает тип: ромб — тема, многогранник — документ, кольцо — активное голосование, куб — снимок.', en: 'Shape shows type: diamond for topic, polyhedron for document, ring for active vote, cube for snapshot.' },

  // админ
  'ad.title': { ru: 'Админ-панель', en: 'Admin panel' },
  'ad.sub': {
    ru: 'Администратор управляет проверяемыми исходными данными, а не итоговыми числами',
    en: 'The administrator manages verifiable inputs, not final numbers',
  },
  'ad.quals': { ru: 'Очередь квалификаций', en: 'Qualification queue' },
  'ad.policies': { ru: 'Политики категорий', en: 'Category policies' },
  'ad.newElection': { ru: 'Новое голосование', en: 'New election' },
  'ad.log': { ru: 'Журнал действий', en: 'Action log' },
  'ad.content': { ru: 'Темы и графы', en: 'Topics and graphs' },
  'ad.approve': { ru: 'Утвердить', en: 'Approve' },
  'ad.reject': { ru: 'Отклонить', en: 'Reject' },
  'ad.quotas': { ru: 'Квоты уровней', en: 'Level quotas' },
  'ad.floors': { ru: 'Минимальные веса', en: 'Floor weights' },
  'ad.cap': { ru: 'Предел веса', en: 'Weight cap' },
  'ad.preview': { ru: 'Предварительный расчёт снимка', en: 'Snapshot pre-calculation' },
  'ad.applyPolicy': { ru: 'Опубликовать политику', en: 'Publish policy' },
  'ad.quotaSum': { ru: 'Сумма квот', en: 'Quota sum' },
  'ad.emptyQueue': { ru: 'Очередь пуста', en: 'Queue is empty' },
  'ad.threshold': { ru: 'Порог администраторов', en: 'Admin threshold' },
  'ad.snapshotOk': { ru: 'Снимок допустим', en: 'Snapshot is valid' },
  'ad.snapshotBad': { ru: 'Снимок будет отклонён', en: 'Snapshot will be rejected' },
  'ad.createElection': { ru: 'Создать голосование', en: 'Create election' },
  'ad.amendmentFree': { ru: 'Поправка без активного голосования', en: 'Amendment without an active election' },
  'ad.approved': { ru: 'Утверждено. Создана новая ревизия квалификации.', en: 'Approved. Qualification revision created.' },
  'ad.policyPublished': { ru: 'Политика опубликована (новая версия)', en: 'Policy published (new version)' },
  'ad.electionCreated': { ru: 'Голосование создано со снимком', en: 'Election created with snapshot' },

  // настройки
  'se.title': { ru: 'Настройки', en: 'Settings' },
  'se.sound': { ru: 'Звук интерфейса', en: 'Interface sound' },
  'se.soundHint': { ru: 'Тихие сигналы: клики, подтверждения, предупреждения', en: 'Quiet earcons: clicks, confirms, warnings' },
  'se.volume': { ru: 'Громкость', en: 'Volume' },
  'se.motion': { ru: 'Сократить анимации', en: 'Reduce motion' },
  'se.motionHint': { ru: 'Отключает переходы и автодрейф графа', en: 'Disables transitions and graph auto-drift' },
  'se.lang': { ru: 'Язык интерфейса', en: 'Interface language' },
  'se.identity': { ru: 'Личности вместо адресов', en: 'Identities instead of addresses' },
  'se.network': { ru: 'Сеть', en: 'Network' },
  'se.networkHint': {
    ru: 'Демонстрационный режим использует локальные данные без блокчейна. Тестовая и основная сети подключаются через шлюз Aptos.',
    en: 'Demo is local data without a blockchain. Testnet/Mainnet connect via the Aptos gateway.',
  },
  'se.trust': {
    ru: 'Интерфейс не является источником истины: уровни, квоты, снимки и голоса проверяются контрактом.',
    en: 'The frontend is not the source of truth: levels, quotas, snapshots and votes are verified by the contract.',
  },
  'se.theme': { ru: 'Оформление', en: 'Appearance' },
  'se.light': { ru: 'Светлое', en: 'Light' },
  'se.dark': { ru: 'Тёмное', en: 'Dark' },
  'se.system': { ru: 'Системное', en: 'System' },
  'se.dataLanguage': { ru: 'Язык типов данных', en: 'Data type language' },
  'se.auto': { ru: 'Как интерфейс', en: 'Follow interface' },
  'se.defaultDocumentsView': { ru: 'Документы при открытии', en: 'Default document view' },

  // тосты
  'toast.voted': { ru: 'Голос учтён. Квитанция создана.', en: 'Vote counted. Receipt created.' },
  'toast.revoted': { ru: 'Вклад заменён. Прежняя ревизия сохранена в аудите.', en: 'Contribution replaced. Previous revision kept in audit.' },
  'toast.sum': { ru: 'Сумма долей должна быть ровно 100%', en: 'Shares must sum to exactly 100%' },
} satisfies Record<string, LStr>

export type DictKey = keyof typeof dict

export const LangCtx = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({
  lang: 'ru',
  setLang: () => {},
})

export function useLang() {
  return useContext(LangCtx)
}

export function useT() {
  const { lang } = useContext(LangCtx)
  const t = (key: DictKey) => dict[key][lang]
  const l = (s: LStr | undefined) => (s ? s[lang] : '')
  return { t, l, lang }
}

export function fmtDate(iso: string, lang: Lang, withTime = false) {
  const d = new Date(iso)
  return d.toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-GB', {
    day: 'numeric', month: 'short',
    ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
  })
}

export function daysLeft(iso: string) {
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000))
}

export function shortAddr(a: string) {
  return a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a
}
