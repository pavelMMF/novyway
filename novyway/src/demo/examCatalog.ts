import type { Exam, ExamItem, QualificationLevel } from '../domain/types'

type Pair = [ru: string, en: string]

const choice = (id: string, labels: Pair[]) => labels.map(([ru, en], index) => ({ id: `${id}-${index}`, label: { ru, en } }))
const single = (id: string, prompt: Pair, labels: Pair[], correct = 0, explanation?: Pair): ExamItem => ({
  id, kind: 'single_choice', scored: true, prompt: { ru: prompt[0], en: prompt[1] },
  options: choice(id, labels), correct: `${id}-${correct}`,
  explanation: explanation ? { ru: explanation[0], en: explanation[1] } : undefined,
})
const multiple = (id: string, prompt: Pair, labels: Pair[], correct: number[], explanation?: Pair): ExamItem => ({
  id, kind: 'multiple_choice', scored: true, prompt: { ru: prompt[0], en: prompt[1] },
  options: choice(id, labels), correct: correct.map((index) => `${id}-${index}`),
  explanation: explanation ? { ru: explanation[0], en: explanation[1] } : undefined,
})
const numeric = (id: string, prompt: Pair, answer: number, tolerance: number, unit: Pair, explanation?: Pair): ExamItem => ({
  id, kind: 'numeric', scored: true, prompt: { ru: prompt[0], en: prompt[1] }, answer, tolerance,
  unit: { ru: unit[0], en: unit[1] }, explanation: explanation ? { ru: explanation[0], en: explanation[1] } : undefined,
})

interface CategoryExamSpec {
  slug: string
  categoryId: string
  name: Pair
  sources: { label: { ru: string; en: string }; url: string }[]
  scenarios: Pair[]
  foundations: ExamItem[]
  levels: [ExamItem[], ExamItem[], ExamItem[]]
}

function buildCategoryExams(spec: CategoryExamSpec): Exam[] {
  return ([1, 2, 3] as QualificationLevel[]).map((level) => ({
    id: `x-${spec.slug}-${level}`,
    categoryId: spec.categoryId,
    targetLevel: level,
    title: {
      ru: `${spec.name[0]}: ${level === 1 ? 'основы' : level === 2 ? 'прикладной анализ' : 'экспертные решения'} L${level}`,
      en: `${spec.name[1]}: ${level === 1 ? 'foundations' : level === 2 ? 'applied analysis' : 'expert decisions'} L${level}`,
    },
    minutes: level === 1 ? 18 : level === 2 ? 24 : 32,
    passShare: level === 1 ? 0.7 : level === 2 ? 0.75 : 0.8,
    version: 1,
    sources: spec.sources,
    items: [
      { id: `${spec.slug}-${level}-scenario`, kind: 'scenario', scored: false, prompt: { ru: spec.scenarios[level - 1][0], en: spec.scenarios[level - 1][1] } },
      ...spec.foundations,
      ...spec.levels[level - 1],
    ],
  }))
}

const economics: CategoryExamSpec = {
  slug: 'econ', categoryId: 'c-econ', name: ['Экономика', 'Economics'],
  sources: [
    { label: { ru: 'МВФ: «Инфляция — рост цен»', en: 'IMF: Inflation — Prices on the Rise' }, url: 'https://www.imf.org/en/publications/fandd/issues/series/back-to-basics/inflation' },
    { label: { ru: 'МВФ: «Денежно-кредитная политика — стабилизация цен и выпуска»', en: 'IMF: Monetary Policy — Stabilizing Prices and Output' }, url: 'https://www.imf.org/en/publications/fandd/issues/series/back-to-basics/monetary-policy' },
  ],
  scenarios: [
    ['Совет оценивает городской бюджет при росте цен и ограниченных ресурсах. Отвечайте, отделяя номинальные показатели от реальных.', 'The Council evaluates a city budget amid rising prices and scarce resources. Separate nominal from real measures.'],
    ['Город выбирает между субсидией, налоговой льготой и прямыми расходами. Оценивайте стимулы, альтернативные издержки и распределительные эффекты.', 'A city chooses between a subsidy, tax relief, and direct spending. Assess incentives, opportunity costs, and distributional effects.'],
    ['Комитет готовит антикризисный пакет при инфляции выше цели и замедлении выпуска. Ищите компромиссы, временные лаги и риски доверия.', 'A committee prepares a crisis package with above-target inflation and slowing output. Look for trade-offs, lags, and credibility risks.'],
  ],
  foundations: [
    single('econ-f1', ['Что точнее всего описывает инфляцию?', 'What best describes inflation?'], [['Устойчивый рост общего уровня цен', 'A sustained rise in the general price level'], ['Рост цены одного товара', 'A rise in one product price'], ['Любое падение курса акции', 'Any fall in a stock price']], 0),
    single('econ-f2', ['Какой инструмент обычно относится к денежно-кредитной политике?', 'Which tool usually belongs to monetary policy?'], [['Ключевая процентная ставка', 'A policy interest rate'], ['Ставка подоходного налога', 'An income-tax rate'], ['Муниципальный тендер', 'A municipal tender']], 0),
    single('econ-f3', ['Если номинальный доход не меняется, а цены растут, что происходит с покупательной способностью?', 'If nominal income is unchanged while prices rise, what happens to purchasing power?'], [['Снижается', 'It falls'], ['Растёт', 'It rises'], ['Всегда остаётся прежней', 'It always stays unchanged']], 0),
    numeric('econ-f4', ['Индекс цен вырос со 100 до 108. Какова инфляция в процентах?', 'A price index rises from 100 to 108. What is inflation in percent?'], 8, 0.05, ['%', '%']),
  ],
  levels: [
    [
      single('econ-l1-1', ['Альтернативная стоимость решения — это…', 'The opportunity cost of a decision is…'], [['ценность лучшей отвергнутой альтернативы', 'the value of the best forgone alternative'], ['любая бухгалтерская выплата', 'any accounting payment'], ['только стоимость кредита', 'only the cost of credit']], 0),
      single('econ-l1-2', ['Как отрицательная внешняя эффектность проявляется в городе?', 'How does a negative externality appear in a city?'], [['Загрязнение перекладывает издержки на жителей', 'Pollution shifts costs to residents'], ['Покупатель платит полную цену товара', 'A buyer pays the full product price'], ['Библиотека открывает данные', 'A library opens its data']], 0),
      multiple('econ-l1-3', ['Какие свойства характерны для чистого общественного блага?', 'Which properties characterize a pure public good?'], [['Неисключаемость', 'Non-excludability'], ['Несоперничество', 'Non-rivalry'], ['Обязательная прибыльность', 'Mandatory profitability'], ['Фиксированная рыночная цена', 'A fixed market price']], [0, 1]),
      numeric('econ-l1-4', ['Доходы бюджета 120, расходы 135. Каков дефицит?', 'Budget revenue is 120 and spending is 135. What is the deficit?'], 15, 0.01, ['млн', 'million']),
      single('econ-l1-5', ['Что обычно происходит со спросом при росте цены, при прочих равных?', 'What usually happens to demand when price rises, other things equal?'], [['Объём спроса снижается', 'Quantity demanded falls'], ['Объём спроса всегда растёт', 'Quantity demanded always rises'], ['Предложение исчезает', 'Supply disappears']], 0),
      single('econ-l1-6', ['Почему сравнивают расходы с результатом, а не только с планом?', 'Why compare spending with outcomes, not only with the plan?'], [['Чтобы оценить эффективность', 'To assess effectiveness'], ['Чтобы скрыть альтернативы', 'To hide alternatives'], ['Чтобы отменить аудит', 'To cancel auditing']], 0),
    ],
    [
      numeric('econ-l2-1', ['Номинальная ставка 7%, инфляция 4%. Приблизительная реальная ставка?', 'Nominal interest is 7% and inflation is 4%. Approximate real rate?'], 3, 0.15, ['%', '%']),
      single('econ-l2-2', ['Что является автоматическим стабилизатором?', 'What is an automatic stabilizer?'], [['Налоги и пособия, меняющиеся с циклом без нового закона', 'Taxes and benefits changing with the cycle without a new law'], ['Разовый инфраструктурный указ', 'A one-off infrastructure decree'], ['Фиксированный валютный курс сам по себе', 'A fixed exchange rate by itself']], 0),
      single('econ-l2-3', ['Чем государственный долг отличается от дефицита?', 'How does public debt differ from a deficit?'], [['Долг — накопленный запас, дефицит — поток за период', 'Debt is a stock; deficit is a flow over a period'], ['Разницы нет', 'There is no difference'], ['Дефицит всегда больше долга', 'A deficit is always larger than debt']], 0),
      numeric('econ-l2-4', ['Цена выросла на 10%, объём спроса упал на 20%. Модуль ценовой эластичности?', 'Price rises 10% and quantity demanded falls 20%. Absolute price elasticity?'], 2, 0.05, ['', '']),
      multiple('econ-l2-5', ['Какие эффекты стоит проверить перед субсидией?', 'Which effects should be checked before a subsidy?'], [['Кто получает выгоду', 'Who receives the benefit'], ['Искажение стимулов', 'Distorted incentives'], ['Бюджетная стоимость', 'Fiscal cost'], ['Только цвет формы заявки', 'Only the application form color']], [0, 1, 2]),
      single('econ-l2-6', ['Почему временная мера должна иметь критерий завершения?', 'Why should a temporary measure have an exit criterion?'], [['Чтобы снизить риск постоянных неэффективных расходов', 'To reduce the risk of permanent inefficient spending'], ['Чтобы запретить оценку', 'To prohibit evaluation'], ['Чтобы исключить публикацию данных', 'To exclude data publication']], 0),
    ],
    [
      single('econ-l3-1', ['При высокой инфляции и падении выпуска политика сталкивается с…', 'With high inflation and falling output, policy faces…'], [['компромиссом между стабилизацией цен и выпуска', 'a trade-off between price and output stabilization'], ['отсутствием любых ограничений', 'no constraints at all'], ['гарантированным профицитом', 'a guaranteed surplus']], 0),
      multiple('econ-l3-2', ['Что укрепляет доверие к экономическому решению?', 'What strengthens credibility of an economic decision?'], [['Публичная цель', 'A public objective'], ['Проверяемые данные', 'Verifiable data'], ['Последовательная коммуникация', 'Consistent communication'], ['Скрытые исключения', 'Hidden exceptions']], [0, 1, 2]),
      numeric('econ-l3-3', ['Проект даёт 110 через год при ставке дисконтирования 10%. Текущая стоимость?', 'A project returns 110 in one year at a 10% discount rate. Present value?'], 100, 0.1, ['ед.', 'units']),
      single('econ-l3-4', ['Почему денежная политика действует с лагом?', 'Why does monetary policy operate with a lag?'], [['Решения о кредитах, ценах и инвестициях меняются не мгновенно', 'Credit, pricing, and investment decisions do not change instantly'], ['Процентная ставка не публикуется', 'The interest rate is never published'], ['Деньги не влияют на ожидания', 'Money never affects expectations']], 0),
      single('econ-l3-5', ['Как корректнее оценивать пилотную программу?', 'How should a pilot program be evaluated?'], [['Заранее задать метрики и контрфактическое сравнение', 'Predefine metrics and a counterfactual comparison'], ['Оценить только число пресс-релизов', 'Count only press releases'], ['Менять цель после результата', 'Change the goal after seeing results']], 0),
      multiple('econ-l3-6', ['Какие риски есть у ценового потолка ниже равновесия?', 'What risks arise from a price ceiling below equilibrium?'], [['Дефицит', 'Shortage'], ['Неценовое распределение', 'Non-price rationing'], ['Снижение предложения', 'Reduced supply'], ['Гарантированный рост качества', 'Guaranteed quality growth']], [0, 1, 2]),
    ],
  ],
}

const technology: CategoryExamSpec = {
  slug: 'tech', categoryId: 'c-tech', name: ['Технологии', 'Technology'],
  sources: [{ label: { ru: 'НИСТ: Основы кибербезопасности 2.0', en: 'NIST Cybersecurity Framework 2.0' }, url: 'https://www.nist.gov/publications/nist-cybersecurity-framework-csf-20' }],
  scenarios: [
    ['Команда подключает сайт голосования к публичной сети. Выберите решения, которые не переносят доверие в браузер.', 'A team connects the voting site to a public network. Choose solutions that do not move trust into the browser.'],
    ['Ретранслятор, индексатор и программный интерфейс работают отдельно. Оценивайте границы доверия, идемпотентность и восстановление.', 'The relayer, indexer, and API run separately. Assess trust boundaries, idempotency, and recovery.'],
    ['Система готовится к аудиту и отказам инфраструктуры. Ищите проверяемость, ротацию ключей и контролируемую деградацию.', 'The system prepares for audit and infrastructure failures. Look for verifiability, key rotation, and controlled degradation.'],
  ],
  foundations: [
    single('tech-f1', ['Принцип наименьших привилегий означает…', 'Least privilege means…'], [['давать только необходимые права', 'grant only necessary permissions'], ['давать всем роль администратора', 'make everyone an administrator'], ['хранить один общий пароль', 'store one shared password']], 0),
    single('tech-f2', ['Чем хеш отличается от шифрования?', 'How does hashing differ from encryption?'], [['Хеш обычно односторонний, шифрование обратимо с ключом', 'Hashing is generally one-way; encryption is reversible with a key'], ['Хеш всегда скрывает длину', 'A hash always hides length'], ['Шифрование не использует ключи', 'Encryption uses no keys']], 0),
    multiple('tech-f3', ['Что даёт многофакторная аутентификация?', 'What does multi-factor authentication provide?'], [['Снижает риск компрометации одного фактора', 'Reduces risk from one compromised factor'], ['Добавляет независимый фактор проверки', 'Adds an independent verification factor'], ['Гарантирует отсутствие любых атак', 'Guarantees no attacks ever']], [0, 1]),
    single('tech-f4', ['Зачем нужна проверяемая резервная копия?', 'Why is a verified backup needed?'], [['Чтобы восстановление было реально проверено', 'So recovery is actually tested'], ['Чтобы заменить контроль доступа', 'To replace access control'], ['Чтобы хранить приватные ключи публично', 'To store private keys publicly']], 0),
  ],
  levels: [
    [
      single('tech-l1-1', ['Где должен храниться приватный ключ relayer?', 'Where should a relayer private key be stored?'], [['В защищённом backend/KMS', 'In a protected backend/KMS'], ['В localStorage', 'In localStorage'], ['В публичном Vite env', 'In a public Vite env']], 0),
      single('tech-l1-2', ['Зачем HTTPS при работе с API?', 'Why use HTTPS for an API?'], [['Для защиты канала и подлинности сервера', 'To protect the channel and authenticate the server'], ['Чтобы заменить авторизацию', 'To replace authorization'], ['Чтобы сделать хеш обратимым', 'To make hashes reversible']], 0),
      single('tech-l1-3', ['Что делает idempotency key?', 'What does an idempotency key do?'], [['Не допускает повторного эффекта одного запроса', 'Prevents duplicate effects from one request'], ['Ускоряет GPU', 'Speeds up the GPU'], ['Шифрует базу', 'Encrypts the database']], 0),
      multiple('tech-l1-4', ['Что проверять во входных данных?', 'What should input validation check?'], [['Тип', 'Type'], ['Диапазон', 'Range'], ['Допустимый формат', 'Allowed format'], ['Любимый цвет пользователя', 'The user’s favorite color']], [0, 1, 2]),
      numeric('tech-l1-5', ['Из 1000 запросов 990 успешны. Доступность в процентах?', '990 of 1000 requests succeed. Availability percent?'], 99, 0.01, ['%', '%']),
      single('tech-l1-6', ['Почему индексатор не является единственным доказательством?', 'Why is an indexer not the sole proof source?'], [['Его данные должны сверяться с публичной сетью', 'Its data must be checked against the public network'], ['Он всегда работает без базы', 'It always runs without a database'], ['Он хранит приватный ключ пользователя', 'It stores the user private key']], 0),
    ],
    [
      multiple('tech-l2-1', ['Какие функции входят в NIST CSF 2.0?', 'Which functions are in NIST CSF 2.0?'], [['Govern', 'Govern'], ['Identify', 'Identify'], ['Protect', 'Protect'], ['Detect', 'Detect'], ['Respond', 'Respond'], ['Recover', 'Recover'], ['Monetize', 'Monetize']], [0, 1, 2, 3, 4, 5]),
      single('tech-l2-2', ['Что описывает trust boundary?', 'What does a trust boundary describe?'], [['Место, где меняются предположения о доверии', 'Where trust assumptions change'], ['Только границу экрана', 'Only a screen border'], ['Лимит размера файла', 'A file-size limit']], 0),
      single('tech-l2-3', ['Как защищаться от replay-запросов?', 'How can replay requests be mitigated?'], [['Nonce/срок действия и идемпотентность', 'Nonce/expiry and idempotency'], ['Повторно использовать одну подпись', 'Reuse one signature'], ['Отключить журнал', 'Disable logging']], 0),
      single('tech-l2-4', ['Почему сериализация перед хешированием должна быть детерминированной?', 'Why must serialization before hashing be deterministic?'], [['Одинаковые данные должны давать одинаковые байты и хеш', 'The same data must produce the same bytes and hash'], ['Чтобы хеш был короче', 'To make the hash shorter'], ['Чтобы отменить версии', 'To eliminate versions']], 0),
      numeric('tech-l2-5', ['P95 задержка снизилась с 500 до 350 мс. Снижение в процентах?', 'P95 latency drops from 500 to 350 ms. Percent reduction?'], 30, 0.1, ['%', '%']),
      multiple('tech-l2-6', ['Что входит в хорошую модель угроз?', 'What belongs in a useful threat model?'], [['Активы', 'Assets'], ['Границы доверия', 'Trust boundaries'], ['Возможности атакующего', 'Attacker capabilities'], ['Только список библиотек', 'Only a library list']], [0, 1, 2]),
    ],
    [
      single('tech-l3-1', ['Зачем ротация ключей должна быть версионируемой?', 'Why should key rotation be versioned?'], [['Чтобы проверять подписи, созданные разными действовавшими ключами', 'To verify signatures created by different active keys'], ['Чтобы удалить аудит', 'To delete audit history'], ['Чтобы не хранить время', 'To avoid timestamps']], 0),
      single('tech-l3-2', ['Что доказывает Merkle proof?', 'What does a Merkle proof demonstrate?'], [['Включение элемента в набор с известным корнем', 'An item’s inclusion in a set with a known root'], ['Знание приватного ключа', 'Knowledge of a private key'], ['Доступность всех API', 'Availability of every API']], 0),
      multiple('tech-l3-3', ['Что улучшает устойчивость relayer?', 'What improves relayer resilience?'], [['Ограничение скорости', 'Rate limiting'], ['Очередь с повтором', 'A retry queue'], ['Разделение ключей', 'Key separation'], ['Один бессрочный root-token', 'One perpetual root token']], [0, 1, 2]),
      numeric('tech-l3-4', ['RPO равно 15 минут. Какой максимальный допустимый объём потери данных во времени?', 'RPO is 15 minutes. What maximum time span of data loss is acceptable?'], 15, 0, ['мин', 'min']),
      single('tech-l3-5', ['Почему eventual consistency нельзя маскировать как подтверждение?', 'Why must eventual consistency not be shown as confirmation?'], [['Пользователь должен отличать submitted от finalized', 'Users must distinguish submitted from finalized'], ['Она всегда быстрее финальности', 'It is always faster than finality'], ['UI не показывает статусы', 'UI has no statuses']], 0),
      multiple('tech-l3-6', ['Какие данные нужны для воспроизводимого аудита?', 'What data is needed for reproducible audit?'], [['Версия схемы', 'Schema version'], ['Хеш входных данных', 'Input hash'], ['Ссылка на транзакцию', 'Transaction reference'], ['Случайный цвет карточки', 'A random card color']], [0, 1, 2]),
    ],
  ],
}

const law: CategoryExamSpec = {
  slug: 'law', categoryId: 'c-law', name: ['Право и управление', 'Law and governance'],
  sources: [
    { label: { ru: 'Совет Европы: Контрольный список верховенства права', en: 'Council of Europe: Rule of Law Checklist' }, url: 'https://www.coe.int/en/web/venice-commission/rule-of-law-checklist' },
    { label: { ru: 'ОЭСР: Руководство по участию граждан', en: 'OECD Guidelines for Citizen Participation Processes' }, url: 'https://www.oecd.org/en/publications/2022/09/oecd-guidelines-for-citizen-participation-processes_63b34541.html' },
  ],
  scenarios: [
    ['Организация принимает внутренний регламент. Оценивайте ясность правил, равенство процедур и возможность проверки.', 'An organization adopts internal rules. Assess clarity, procedural equality, and verifiability.'],
    ['Совет делегирует полномочия и рассматривает конфликт интересов. Ищите пределы усмотрения и механизмы контроля.', 'The Council delegates powers and reviews a conflict of interest. Look for limits on discretion and oversight.'],
    ['Вводится чрезвычайная процедура. Оценивайте законность, необходимость, пропорциональность и срок действия.', 'An emergency procedure is introduced. Assess legality, necessity, proportionality, and duration.'],
  ],
  foundations: [
    single('law-f1', ['Что требует принцип законности?', 'What does legality require?'], [['Действия власти основаны на заранее установленных правилах', 'Public action is based on pre-established rules'], ['Решения не публикуются', 'Decisions remain unpublished'], ['Любое усмотрение не ограничено', 'All discretion is unlimited']], 0),
    single('law-f2', ['Юридическая определённость означает…', 'Legal certainty means…'], [['правила ясны, доступны и предсказуемы', 'rules are clear, accessible, and predictable'], ['правила меняются задним числом', 'rules change retroactively'], ['исключения скрыты', 'exceptions are hidden']], 0),
    multiple('law-f3', ['Какие элементы относятся к верховенству права?', 'Which elements belong to the rule of law?'], [['Равенство перед законом', 'Equality before the law'], ['Предотвращение злоупотребления властью', 'Prevention of abuse of power'], ['Доступ к правосудию', 'Access to justice'], ['Тайные бессрочные полномочия', 'Secret indefinite powers']], [0, 1, 2]),
    single('law-f4', ['Зачем публиковать мотивировку решения?', 'Why publish reasons for a decision?'], [['Чтобы решение можно было понять и оспорить', 'So the decision can be understood and challenged'], ['Чтобы заменить норму', 'To replace the rule'], ['Чтобы скрыть конфликт интересов', 'To conceal conflicts']], 0),
  ],
  levels: [
    [
      single('law-l1-1', ['Как применять правило к сходным случаям?', 'How should a rule apply to similar cases?'], [['Последовательно, если нет обоснованного различия', 'Consistently unless a justified distinction exists'], ['Случайно', 'Randomly'], ['По скрытому списку', 'By a hidden list']], 0),
      multiple('law-l1-2', ['Что должно быть в уведомлении о голосовании?', 'What should an election notice contain?'], [['Предмет решения', 'Decision subject'], ['Сроки', 'Timing'], ['Правила участия', 'Participation rules'], ['Приватный ключ администратора', 'Administrator private key']], [0, 1, 2]),
      single('law-l1-3', ['Конфликт интересов требует прежде всего…', 'A conflict of interest primarily requires…'], [['раскрытия и управления конфликтом', 'disclosure and management'], ['удаления аудита', 'audit deletion'], ['автоматического одобрения', 'automatic approval']], 0),
      numeric('law-l1-4', ['Для порога 2 из 3 сколько одобрений необходимо?', 'For a 2-of-3 threshold, how many approvals are required?'], 2, 0, ['голоса', 'votes']),
      single('law-l1-5', ['Почему изменение правил во время голосования проблемно?', 'Why is changing rules during an election problematic?'], [['Нарушает предсказуемость и равные условия', 'It undermines predictability and equal conditions'], ['Ускоряет аудит', 'It speeds up audit'], ['Всегда повышает явку', 'It always raises turnout']], 0),
      single('law-l1-6', ['Что даёт право на обжалование?', 'What does a right of appeal provide?'], [['Проверку решения независимым или вышестоящим механизмом', 'Review by an independent or higher mechanism'], ['Неограниченную власть оператора', 'Unlimited operator power'], ['Удаление доказательств', 'Deletion of evidence']], 0),
    ],
    [
      single('law-l2-1', ['Тест пропорциональности проверяет…', 'A proportionality test examines…'], [['пригодность, необходимость и баланс меры', 'suitability, necessity, and balancing'], ['только популярность меры', 'only popularity'], ['только длину документа', 'only document length']], 0),
      multiple('law-l2-2', ['Что поддерживает систему сдержек и противовесов?', 'What supports checks and balances?'], [['Разделение функций', 'Separation of functions'], ['Независимый контроль', 'Independent oversight'], ['Публичная отчётность', 'Public accountability'], ['Неограниченное самоутверждение решений', 'Unlimited self-approval']], [0, 1, 2]),
      single('law-l2-3', ['Допустимое делегирование полномочий требует…', 'Valid delegation of power requires…'], [['ясного объёма, цели и контроля', 'clear scope, purpose, and oversight'], ['устной бессрочной передачи', 'an oral indefinite transfer'], ['отсутствия ответственного', 'no accountable party']], 0),
      single('law-l2-4', ['Принцип минимизации данных означает…', 'Data minimization means…'], [['собирать только необходимое для заявленной цели', 'collect only what is needed for the stated purpose'], ['собирать всё на будущее', 'collect everything for future use'], ['публиковать приватные ключи', 'publish private keys']], 0),
      numeric('law-l2-5', ['В совете 5 администраторов, порог простого большинства. Минимум голосов?', 'A council has 5 administrators and a simple-majority threshold. Minimum votes?'], 3, 0, ['голоса', 'votes']),
      multiple('law-l2-6', ['Что делает консультацию добросовестной?', 'What makes a consultation genuine?'], [['Ясная цель', 'A clear purpose'], ['Доступная информация', 'Accessible information'], ['Публичный ответ на вклад', 'A public response to input'], ['Решение до начала консультации без возможности изменения', 'An unchangeable decision made before consultation']], [0, 1, 2]),
    ],
    [
      multiple('law-l3-1', ['Какие условия нужны чрезвычайной мере?', 'What conditions should an emergency measure meet?'], [['Правовое основание', 'Legal basis'], ['Необходимость', 'Necessity'], ['Ограниченный срок', 'Limited duration'], ['Независимый контроль', 'Independent oversight'], ['Бессрочная секретность', 'Indefinite secrecy']], [0, 1, 2, 3]),
      single('law-l3-2', ['Почему независимость проверяющего органа важна?', 'Why is reviewer independence important?'], [['Снижает риск контроля самим субъектом решения', 'It reduces self-review risk'], ['Гарантирует нужный исход', 'It guarantees a desired result'], ['Отменяет мотивировку', 'It removes the need for reasons']], 0),
      single('law-l3-3', ['Обратная сила ухудшающего правила обычно опасна потому, что…', 'Retroactive application of a burdensome rule is risky because…'], [['подрывает предсказуемость и доверие', 'it undermines predictability and trust'], ['всегда сокращает текст', 'it always shortens text'], ['увеличивает доступность', 'it increases accessibility']], 0),
      numeric('law-l3-4', ['Для изменения устава требуется 3/5 голосов из 10 участников. Минимум голосов?', 'A charter change needs 3/5 of 10 participants. Minimum votes?'], 6, 0, ['голосов', 'votes']),
      multiple('law-l3-5', ['Что делает цифровое решение проверяемым?', 'What makes a digital decision verifiable?'], [['Неизменяемая история', 'Immutable history'], ['Версия применённых правил', 'Versioned applied rules'], ['Связь с доказательствами', 'Links to evidence'], ['Скрытая смена результата', 'Hidden result changes']], [0, 1, 2]),
      single('law-l3-6', ['Как разрешать коллизию общих и специальных правил?', 'How should a conflict between general and specific rules be handled?'], [['Применить заранее установленный принцип приоритета и объяснить его', 'Apply a pre-established priority rule and explain it'], ['Выбрать правило после результата', 'Choose after seeing the result'], ['Игнорировать оба правила', 'Ignore both rules']], 0),
    ],
  ],
}

const ecology: CategoryExamSpec = {
  slug: 'eco', categoryId: 'c-eco', name: ['Экология', 'Ecology'],
  sources: [{ label: { ru: 'МГЭИК: Обобщающий доклад ДО6 для руководителей', en: 'IPCC AR6 Synthesis Report: Summary for Policymakers' }, url: 'https://www.ipcc.ch/report/ar6/syr/summary-for-policymakers/' }],
  scenarios: [
    ['Город восстанавливает лесные участки и оценивает пользу для жителей. Различайте меры смягчения, адаптации и охраны биоразнообразия.', 'A city restores forest sites and evaluates public benefits. Distinguish mitigation, adaptation, and biodiversity protection.'],
    ['Программа сравнивает несколько природных решений. Учитывайте базовую линию, жизненный цикл и качество мониторинга.', 'A program compares nature-based solutions. Consider baselines, life cycles, and monitoring quality.'],
    ['Совет оценивает долгосрочный климатический портфель. Проверяйте дополнительность, утечки, постоянство и справедливость.', 'The Council evaluates a long-term climate portfolio. Check additionality, leakage, permanence, and equity.'],
  ],
  foundations: [
    single('eco-f1', ['Чем смягчение изменения климата отличается от адаптации?', 'How does climate mitigation differ from adaptation?'], [['Смягчение снижает причины, адаптация уменьшает последствия', 'Mitigation reduces causes; adaptation reduces impacts'], ['Это одно и то же', 'They are the same'], ['Адаптация всегда увеличивает выбросы', 'Adaptation always raises emissions']], 0),
    single('eco-f2', ['Биоразнообразие включает…', 'Biodiversity includes…'], [['разнообразие генов, видов и экосистем', 'diversity of genes, species, and ecosystems'], ['только число деревьев', 'only tree count'], ['только охраняемые территории', 'only protected areas']], 0),
    multiple('eco-f3', ['Какие примеры относятся к экосистемным услугам?', 'Which are ecosystem services?'], [['Регулирование стока воды', 'Water-flow regulation'], ['Опыление', 'Pollination'], ['Рекреация', 'Recreation'], ['Рост цены акции', 'Stock price growth']], [0, 1, 2]),
    single('eco-f4', ['Зачем нужна базовая линия проекта?', 'Why does a project need a baseline?'], [['Чтобы сравнить изменения с ситуацией без проекта', 'To compare changes with the no-project situation'], ['Чтобы исключить мониторинг', 'To remove monitoring'], ['Чтобы гарантировать результат', 'To guarantee the result']], 0),
  ],
  levels: [
    [
      single('eco-l1-1', ['Почему местные виды часто предпочтительнее для восстановления?', 'Why are native species often preferred for restoration?'], [['Они лучше согласованы с местной экосистемой', 'They are better aligned with the local ecosystem'], ['Они никогда не требуют ухода', 'They never need care'], ['Они всегда растут быстрее любых других', 'They always grow fastest']], 0),
      multiple('eco-l1-2', ['Что стоит измерять в городской лесной программе?', 'What should an urban forest program measure?'], [['Выживаемость посадок', 'Plant survival'], ['Площадь кроны', 'Canopy area'], ['Видовое разнообразие', 'Species diversity'], ['Только число пресс-релизов', 'Only press-release count']], [0, 1, 2]),
      numeric('eco-l1-3', ['Посажено 200 деревьев, выжило 170. Выживаемость в процентах?', '200 trees were planted and 170 survived. Survival percent?'], 85, 0.05, ['%', '%']),
      single('eco-l1-4', ['Какой шаг выше переработки в иерархии отходов?', 'Which step ranks above recycling in the waste hierarchy?'], [['Предотвращение образования отходов', 'Waste prevention'], ['Захоронение', 'Landfill'], ['Сжигание без оценки', 'Unassessed incineration']], 0),
      single('eco-l1-5', ['Почему почвенное состояние важно до посадки?', 'Why assess soil before planting?'], [['Оно влияет на воду, питание и приживаемость', 'It affects water, nutrients, and survival'], ['Оно влияет только на цвет таблички', 'It affects only sign color'], ['Почва не влияет на растения', 'Soil does not affect plants']], 0),
      single('eco-l1-6', ['Что уменьшает риск монокультуры?', 'What reduces monoculture risk?'], [['Подбор нескольких совместимых видов', 'Selecting several compatible species'], ['Один клон на всей территории', 'One clone everywhere'], ['Отсутствие мониторинга', 'No monitoring']], 0),
    ],
    [
      single('eco-l2-1', ['Оценка жизненного цикла рассматривает…', 'Life-cycle assessment considers…'], [['воздействия по всей цепочке продукта или проекта', 'impacts across the product or project chain'], ['только финальную рекламу', 'only final advertising'], ['только цену закупки', 'only purchase price']], 0),
      numeric('eco-l2-2', ['Площадь кроны выросла с 40 до 50 га. Рост в процентах?', 'Canopy area rises from 40 to 50 ha. Percent increase?'], 25, 0.05, ['%', '%']),
      multiple('eco-l2-3', ['Что повышает качество экологического мониторинга?', 'What improves environmental monitoring quality?'], [['Повторяемая методика', 'Repeatable methods'], ['Фиксированные точки наблюдений', 'Fixed observation points'], ['Публичные исходные данные', 'Public source data'], ['Смена метрики после результата', 'Changing metrics after results']], [0, 1, 2]),
      single('eco-l2-4', ['Что такое дополнительность?', 'What is additionality?'], [['Эффект не возник бы без проекта', 'The effect would not occur without the project'], ['Любой эффект автоматически дополнительный', 'Every effect is automatically additional'], ['Повторное считывание одного результата', 'Counting one result twice']], 0),
      single('eco-l2-5', ['Как проявляется rebound effect?', 'How can a rebound effect occur?'], [['Эффективность удешевляет использование и часть экономии теряется', 'Efficiency lowers use cost and erodes some savings'], ['Мониторинг полностью прекращается', 'Monitoring stops entirely'], ['Вид исчезает мгновенно', 'A species disappears instantly']], 0),
      multiple('eco-l2-6', ['Какие данные нужны для сравнения природных решений?', 'What data is needed to compare nature-based solutions?'], [['Стоимость жизненного цикла', 'Life-cycle cost'], ['Экологический эффект', 'Environmental outcome'], ['Риски обслуживания', 'Maintenance risks'], ['Только первоначальная фотография', 'Only the initial photo']], [0, 1, 2]),
    ],
    [
      single('eco-l3-1', ['Утечка климатического эффекта означает…', 'Climate leakage means…'], [['воздействие переносится за границы проекта', 'impact shifts outside the project boundary'], ['данные публикуются открыто', 'data is published openly'], ['осадки попадают в почву', 'rain enters soil']], 0),
      single('eco-l3-2', ['Риск постоянства связан с…', 'Permanence risk concerns…'], [['возможной потерей накопленного эффекта в будущем', 'possible future loss of stored benefits'], ['длиной названия проекта', 'project-name length'], ['числом участников сайта', 'site user count']], 0),
      multiple('eco-l3-3', ['Что входит в справедливый климатический переход?', 'What belongs to a just climate transition?'], [['Учёт уязвимых групп', 'Considering vulnerable groups'], ['Распределение затрат и выгод', 'Distribution of costs and benefits'], ['Участие затронутых сообществ', 'Participation of affected communities'], ['Скрытие последствий', 'Concealing impacts']], [0, 1, 2]),
      numeric('eco-l3-4', ['Проект избегает 120 т CO₂e и теряет 10% из-за утечки. Чистый эффект?', 'A project avoids 120 tCO₂e and loses 10% to leakage. Net effect?'], 108, 0.1, ['т CO₂e', 'tCO₂e']),
      single('eco-l3-5', ['Как корректно работать с неопределённостью?', 'How should uncertainty be handled?'], [['Публиковать диапазоны, предположения и чувствительность', 'Publish ranges, assumptions, and sensitivity'], ['Скрывать её', 'Hide it'], ['Заменять среднее максимумом без объяснения', 'Replace the mean with a maximum without explanation']], 0),
      multiple('eco-l3-6', ['Какие совместные выгоды может дать городской лес?', 'What co-benefits can an urban forest provide?'], [['Охлаждение', 'Cooling'], ['Управление стоком', 'Runoff management'], ['Среда обитания', 'Habitat'], ['Гарантированное отсутствие аллергий', 'Guaranteed absence of allergies']], [0, 1, 2]),
    ],
  ],
}

const education: CategoryExamSpec = {
  slug: 'edu', categoryId: 'c-edu', name: ['Образование', 'Education'],
  sources: [
    { label: { ru: 'ЮНЕСКО: Оценивание обучения', en: 'UNESCO: Learning Assessment' }, url: 'https://www.unesco.org/en/query-list/l/learning-assessment' },
    { label: { ru: 'ЮНЕСКО: Учебная программа по медиа- и информационной грамотности', en: 'UNESCO: Media and Information Literacy Curriculum' }, url: 'https://www.unesco.org/mil4teachers/en/introduction' },
  ],
  scenarios: [
    ['Команда создаёт открытый курс и экзамен. Отделяйте цели обучения от удобства проверки и обеспечивайте доступность.', 'A team creates an open course and exam. Separate learning goals from grading convenience and ensure accessibility.'],
    ['Совет оценивает качество банка заданий. Ищите валидность, надёжность, обратную связь и признаки смещения.', 'The Council evaluates an item bank. Look for validity, reliability, feedback, and signs of bias.'],
    ['Организация вводит квалификационный экзамен высокого уровня. Оценивайте стандарт, доказательства валидности и управление версиями.', 'An organization introduces a high-stakes qualification exam. Assess standards, validity evidence, and version governance.'],
  ],
  foundations: [
    single('edu-f1', ['Формирующее оценивание прежде всего нужно для…', 'Formative assessment is primarily used to…'], [['улучшать обучение во время процесса', 'improve learning during the process'], ['только выдавать итоговый сертификат', 'only issue a final certificate'], ['скрывать критерии', 'hide criteria']], 0),
    single('edu-f2', ['Валидность оценивания означает…', 'Assessment validity means…'], [['интерпретация результатов соответствует заявленной цели', 'score interpretation supports the intended purpose'], ['все получают одинаковый балл', 'everyone gets the same score'], ['тест всегда короткий', 'the test is always short']], 0),
    single('edu-f3', ['Надёжность результата связана с…', 'Reliability of a result concerns…'], [['устойчивостью измерения при сопоставимых условиях', 'consistency under comparable conditions'], ['цветом кнопки', 'button color'], ['числом администраторов', 'administrator count']], 0),
    multiple('edu-f4', ['Что поддерживает равный доступ к экзамену?', 'What supports equitable access to an exam?'], [['Доступная навигация', 'Accessible navigation'], ['Понятный язык', 'Clear language'], ['Разумные адаптации', 'Reasonable accommodations'], ['Скрытые требования', 'Hidden requirements']], [0, 1, 2]),
  ],
  levels: [
    [
      single('edu-l1-1', ['Хороший результат обучения описывает…', 'A good learning outcome describes…'], [['что учащийся сможет продемонстрировать', 'what a learner can demonstrate'], ['что преподаватель намерен рассказать', 'what an instructor intends to say'], ['длину занятия', 'lesson length']], 0),
      multiple('edu-l1-2', ['Какая обратная связь полезнее?', 'Which feedback is more useful?'], [['Конкретная', 'Specific'], ['Своевременная', 'Timely'], ['Связанная с критерием', 'Linked to criteria'], ['Только «плохо»', 'Only “bad”']], [0, 1, 2]),
      single('edu-l1-3', ['Для чего нужна рубрика?', 'What is a rubric for?'], [['Чтобы заранее описать критерии качества', 'To describe quality criteria in advance'], ['Чтобы скрыть оценивание', 'To hide scoring'], ['Чтобы заменить вопрос', 'To replace the question']], 0),
      numeric('edu-l1-4', ['Правильно 8 ответов из 10. Результат в процентах?', '8 of 10 answers are correct. Score percent?'], 80, 0.01, ['%', '%']),
      single('edu-l1-5', ['Что делать перед доверием к онлайн-источнику?', 'What should be done before trusting an online source?'], [['Проверить автора, доказательства, дату и цель', 'Check author, evidence, date, and purpose'], ['Смотреть только число лайков', 'Look only at likes'], ['Игнорировать первоисточник', 'Ignore primary sources']], 0),
      single('edu-l1-6', ['Почему один вопрос на экран помогает на мобильном?', 'Why can one question per screen help on mobile?'], [['Снижает когнитивную нагрузку и ошибки навигации', 'It reduces cognitive load and navigation errors'], ['Убирает необходимость подписей', 'It removes the need for labels'], ['Гарантирует правильный ответ', 'It guarantees a correct answer']], 0),
    ],
    [
      numeric('edu-l2-1', ['Из 100 участников 65 ответили на задание правильно. Индекс трудности?', '65 of 100 participants answer an item correctly. Item facility?'], 0.65, 0.005, ['', '']),
      single('edu-l2-2', ['Что показывает дискриминирующая способность задания?', 'What does item discrimination show?'], [['Насколько задание различает более и менее подготовленных', 'How well the item distinguishes stronger and weaker candidates'], ['Сколько символов в вопросе', 'How many characters the prompt has'], ['Скорость сети', 'Network speed']], 0),
      multiple('edu-l2-3', ['Какие признаки могут указывать на смещение задания?', 'What can indicate item bias?'], [['Нерелевантные культурные знания', 'Irrelevant cultural knowledge'], ['Необоснованно сложный язык', 'Unnecessarily complex language'], ['Различия групп после контроля способности', 'Group differences after controlling ability'], ['Стабильный идентификатор', 'A stable identifier']], [0, 1, 2]),
      single('edu-l2-4', ['Почему retrieval practice полезна?', 'Why is retrieval practice useful?'], [['Активное извлечение укрепляет долговременное запоминание', 'Active retrieval strengthens long-term memory'], ['Она исключает обратную связь', 'It removes feedback'], ['Она работает только с картинками', 'It works only with images']], 0),
      numeric('edu-l2-5', ['Проект: 70% оценки с баллом 80, тест: 30% с баллом 90. Итог?', 'Project: 70% weighted score of 80; test: 30% weighted score of 90. Final score?'], 83, 0.01, ['балла', 'points']),
      multiple('edu-l2-6', ['Что входит в медиаграмотность?', 'What belongs to media and information literacy?'], [['Поиск информации', 'Finding information'], ['Критическая оценка', 'Critical evaluation'], ['Этичное создание и распространение', 'Ethical creation and sharing'], ['Автоматическое доверие первому результату', 'Automatic trust in the first result']], [0, 1, 2]),
    ],
    [
      single('edu-l3-1', ['Зачем нужен standard setting?', 'Why is standard setting needed?'], [['Чтобы обосновать границу между уровнями результата', 'To justify the boundary between performance levels'], ['Чтобы выбрать красивый процент', 'To choose an attractive percentage'], ['Чтобы не публиковать критерии', 'To avoid publishing criteria']], 0),
      multiple('edu-l3-2', ['Какие доказательства поддерживают валидность?', 'What evidence supports validity?'], [['Содержание заданий', 'Item content'], ['Внутренняя структура результатов', 'Internal score structure'], ['Связи с внешними переменными', 'Relations to external variables'], ['Только логотип платформы', 'Only the platform logo']], [0, 1, 2]),
      single('edu-l3-3', ['Главный риск адаптивного теста без контроля банка?', 'A major risk of adaptive testing without item-bank controls?'], [['Неравномерная сложность и утечка заданий', 'Uneven difficulty and item exposure'], ['Слишком понятная навигация', 'Navigation that is too clear'], ['Отсутствие цветовой темы', 'No color theme']], 0),
      numeric('edu-l3-4', ['Средний балл 75, стандартная ошибка измерения 3. Нижняя граница диапазона ±1 SEM?', 'Observed score is 75 with SEM 3. Lower bound of ±1 SEM?'], 72, 0.01, ['балла', 'points']),
      single('edu-l3-5', ['Почему версия экзамена должна фиксироваться в evidence?', 'Why should exam version be fixed in evidence?'], [['Чтобы воспроизвести условия старой попытки', 'To reproduce the conditions of an earlier attempt'], ['Чтобы менять ответы задним числом', 'To change answers retroactively'], ['Чтобы скрыть источники', 'To hide sources']], 0),
      multiple('edu-l3-6', ['Что нужно для ответственного экзамена высокого уровня?', 'What is needed for a responsible high-stakes exam?'], [['Пилотирование', 'Piloting'], ['Анализ заданий', 'Item analysis'], ['Процедура апелляции', 'An appeal process'], ['Публичные критерии', 'Public criteria'], ['Неограниченное ручное изменение баллов', 'Unlimited manual score changes']], [0, 1, 2, 3]),
    ],
  ],
}

export const examCatalog: Exam[] = [economics, technology, law, ecology, education].flatMap(buildCategoryExams)
