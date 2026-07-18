const topics = [
  {
    id: 'transport',
    ru: { title: 'выделенные полосы', actor: 'транспортный аналитик', proposal: 'провести двенадцатинедельный пилот выделенных полос', personal: 'дважды опаздывал на заседания', popularity: 'семь из десяти участников городского канала поддержали идею', chain: 'город запретит личные автомобили', sample: 'опросили шесть пассажиров одного утреннего автобуса', before: 'скорость движения выросла', after: 'пилот начался неделей раньше', extreme: 'полностью запретить людям выбирать маршрут', celebrity: 'популярный музыкант', tradition: 'дорожную разметку не меняли двадцать лет', sunk: 'на старую схему уже потратили 400 тысяч рублей', component: 'каждый новый автобус вместительнее прежнего' },
    en: { title: 'dedicated bus lanes', actor: 'a transport analyst', proposal: 'run a twelve-week dedicated-lane pilot', personal: 'was late to two committee meetings', popularity: 'seven of ten members of a city chat supported the idea', chain: 'the city will ban private cars', sample: 'six passengers on one morning bus were surveyed', before: 'traffic speed increased', after: 'the pilot had started one week earlier', extreme: 'ban people from choosing their own route', celebrity: 'a popular musician', tradition: 'the road markings have not changed for twenty years', sunk: '400,000 rubles have already been spent on the old scheme', component: 'each new bus holds more passengers than the old one' },
  },
  {
    id: 'river',
    ru: { title: 'мониторинг реки', actor: 'гидролог', proposal: 'установить датчики качества воды и публиковать показания', personal: 'ведёт скучные лекции', popularity: 'опрос в социальной сети собрал 82% одобрения', chain: 'вся набережная окажется закрыта навсегда', sample: 'взяли две пробы возле одного моста', before: 'вода стала прозрачнее', after: 'датчики включили за три дня до этого', extreme: 'обвинять каждого жителя в загрязнении', celebrity: 'известный телеведущий', tradition: 'качество воды всегда оценивали на глаз', sunk: 'в старые лабораторные журналы вложили пять лет работы', component: 'каждый датчик прошёл отдельную калибровку' },
    en: { title: 'river monitoring', actor: 'a hydrologist', proposal: 'install water-quality sensors and publish their readings', personal: 'gives boring lectures', popularity: 'a social-media poll showed 82 percent support', chain: 'the entire embankment will be closed forever', sample: 'two samples were taken beside one bridge', before: 'the water became clearer', after: 'the sensors had been switched on three days earlier', extreme: 'accuse every resident of pollution', celebrity: 'a famous television host', tradition: 'water quality has always been judged by sight', sunk: 'five years of work went into the old laboratory journals', component: 'every sensor passed an individual calibration' },
  },
  {
    id: 'school',
    ru: { title: 'начало школьных занятий', actor: 'исследователь сна', proposal: 'на один семестр сдвинуть начало занятий на сорок минут', personal: 'не имеет собственных детей', popularity: 'большинство родителей в открытом чате поставили отметку «за»', chain: 'ученики перестанут соблюдать любое расписание', sample: 'поговорили с четырьмя отличниками из одного класса', before: 'посещаемость повысилась', after: 'расписание изменили месяц назад', extreme: 'отменить уроки и домашние задания', celebrity: 'чемпион по шахматам', tradition: 'первый звонок много лет звучит в восемь утра', sunk: 'новые часы для коридоров уже куплены', component: 'каждый отдельный урок стал короче' },
    en: { title: 'school start time', actor: 'a sleep researcher', proposal: 'move the school start time forty minutes later for one term', personal: 'has no children', popularity: 'most parents in an open chat clicked support', chain: 'students will stop following every schedule', sample: 'four top students from one class were interviewed', before: 'attendance improved', after: 'the timetable had changed one month earlier', extreme: 'abolish lessons and homework', celebrity: 'a chess champion', tradition: 'the first bell has rung at eight for many years', sunk: 'new corridor clocks have already been bought', component: 'each individual lesson became shorter' },
  },
  {
    id: 'budget',
    ru: { title: 'резервный фонд', actor: 'бюджетный специалист', proposal: 'ежемесячно публиковать движение средств резервного фонда', personal: 'однажды допустил опечатку в отчёте', popularity: 'идею поддержали 90% посетителей публичной встречи', chain: 'чиновники больше не смогут принимать ни одного быстрого решения', sample: 'изучили три расходные операции за один день', before: 'перерасход снизился', after: 'реестр открыли кварталом раньше', extreme: 'выложить в сеть пароли от банковских счетов', celebrity: 'популярный актёр', tradition: 'сводку всегда хранили только на бумаге', sunk: 'в закрытую систему уже вложили миллион рублей', component: 'каждая строка бюджета получила пояснение' },
    en: { title: 'reserve fund', actor: 'a budget specialist', proposal: 'publish reserve-fund movements every month', personal: 'once made a typo in a report', popularity: '90 percent of visitors at a public meeting supported it', chain: 'officials will never be able to make a quick decision again', sample: 'three spending operations from one day were reviewed', before: 'overspending decreased', after: 'the register had opened one quarter earlier', extreme: 'publish bank-account passwords', celebrity: 'a popular actor', tradition: 'the summary has always been kept only on paper', sunk: 'one million rubles have already been invested in the closed system', component: 'every budget line received an explanation' },
  },
  {
    id: 'clinic',
    ru: { title: 'запись в поликлинику', actor: 'врач-организатор', proposal: 'испытать предварительную онлайн-сортировку обращений', personal: 'плохо оформляет презентации', popularity: 'приложение нравится большинству подписчиков районного канала', chain: 'живого приёма врачей больше никогда не будет', sample: 'спросили пятерых молодых пользователей приложения', before: 'очередь сократилась', after: 'форму запустили двумя неделями раньше', extreme: 'заменить всех врачей автоматическим ответчиком', celebrity: 'известный спортивный комментатор', tradition: 'талон всегда выдавали через регистратуру', sunk: 'на старые терминалы уже потратили крупную сумму', component: 'каждый этап анкеты занимает меньше минуты' },
    en: { title: 'clinic appointments', actor: 'a healthcare operations doctor', proposal: 'pilot online triage before appointments', personal: 'designs poor presentation slides', popularity: 'most subscribers of a district channel like the app', chain: 'in-person doctor visits will disappear forever', sample: 'five young app users were asked', before: 'the queue became shorter', after: 'the form had launched two weeks earlier', extreme: 'replace every doctor with an automated reply', celebrity: 'a famous sports commentator', tradition: 'appointment slips have always been issued at reception', sunk: 'a large sum has already been spent on old terminals', component: 'each step of the form takes less than one minute' },
  },
  {
    id: 'housing',
    ru: { title: 'утепление домов', actor: 'инженер-энергоаудитор', proposal: 'сравнить три технологии утепления на двух пилотных домах', personal: 'живёт в новом районе', popularity: 'самый популярный комментарий требует начать немедленно', chain: 'все исторические фасады будут уничтожены', sample: 'измерили температуру в двух квартирах одного подъезда', before: 'расход тепла уменьшился', after: 'фасад утеплили прошлой осенью', extreme: 'снести дома, которые ещё не утеплены', celebrity: 'популярный блогер о ремонте', tradition: 'такие стены не меняли со времени постройки', sunk: 'на прежний материал уже заключён дорогой контракт', component: 'каждая новая панель выдержала испытание' },
    en: { title: 'building insulation', actor: 'an energy-audit engineer', proposal: 'compare three insulation methods on two pilot buildings', personal: 'lives in a new district', popularity: 'the most-liked comment demands immediate action', chain: 'every historic facade will be destroyed', sample: 'temperatures were measured in two flats in one entrance', before: 'heat consumption decreased', after: 'the facade had been insulated last autumn', extreme: 'demolish buildings that have not yet been insulated', celebrity: 'a popular renovation blogger', tradition: 'these walls have not changed since construction', sunk: 'an expensive contract for the old material has already been signed', component: 'every new panel passed its test' },
  },
  {
    id: 'data',
    ru: { title: 'открытые городские данные', actor: 'специалист по данным', proposal: 'публиковать обезличенные наборы с журналом изменений', personal: 'не пользуется социальными сетями', popularity: 'тысяча человек переслали пост об открытии данных', chain: 'вся личная жизнь жителей станет публичной', sample: 'проверили четыре файла одного департамента', before: 'число найденных ошибок выросло', after: 'портал открылся неделей раньше', extreme: 'выкладывать адреса и медицинские сведения граждан', celebrity: 'известный режиссёр', tradition: 'таблицы всегда отправляли только по запросу', sunk: 'закрытый портал разрабатывали три года', component: 'каждый файл соответствует формату' },
    en: { title: 'open city data', actor: 'a data specialist', proposal: 'publish anonymized datasets with a change log', personal: 'does not use social media', popularity: 'one thousand people shared a post about open data', chain: 'every resident’s private life will become public', sample: 'four files from one department were checked', before: 'more errors were discovered', after: 'the portal had opened one week earlier', extreme: 'publish citizens’ addresses and medical records', celebrity: 'a famous film director', tradition: 'spreadsheets have always been supplied only on request', sunk: 'the closed portal took three years to develop', component: 'every file follows the required format' },
  },
  {
    id: 'forest',
    ru: { title: 'восстановление городского леса', actor: 'эколог', proposal: 'сначала восстановить почву, а затем высадить местные виды деревьев', personal: 'ездит на работу на автомобиле', popularity: 'петиция собрала больше подписей, чем любая другая', chain: 'людям запретят входить во все парки', sample: 'осмотрели три дерева у одной дорожки', before: 'выживаемость саженцев выросла', after: 'почву начали восстанавливать весной', extreme: 'закрыть город и отдать его дикой природе', celebrity: 'популярный путешественник', tradition: 'раньше всегда высаживали один и тот же вид', sunk: 'тысячи старых саженцев уже закуплены', component: 'каждый выбранный вид устойчив к местной зиме' },
    en: { title: 'urban forest restoration', actor: 'an ecologist', proposal: 'restore the soil first and then plant native tree species', personal: 'drives to work', popularity: 'the petition received more signatures than any other', chain: 'people will be banned from every park', sample: 'three trees beside one path were inspected', before: 'sapling survival improved', after: 'soil restoration had begun in spring', extreme: 'close the city and surrender it to wildlife', celebrity: 'a popular travel presenter', tradition: 'the same tree species has always been planted', sunk: 'thousands of old-type saplings have already been purchased', component: 'each selected species tolerates the local winter' },
  },
  {
    id: 'waste',
    ru: { title: 'раздельный сбор отходов', actor: 'координатор коммунальных служб', proposal: 'провести районный пилот с понятной маркировкой контейнеров', personal: 'однажды перепутал даты встречи', popularity: 'опрос жильцов дал 74% голосов «за»', chain: 'за каждую ошибку начнут немедленно штрафовать', sample: 'проверили один двор после праздничного дня', before: 'доля смешанных отходов снизилась', after: 'новые контейнеры поставили месяц назад', extreme: 'запретить людям покупать упакованные товары', celebrity: 'известный шеф-повар', tradition: 'мусор всегда складывали в один контейнер', sunk: 'старые контейнеры недавно перекрасили', component: 'каждая инструкция понятна участникам теста' },
    en: { title: 'separate waste collection', actor: 'a municipal-services coordinator', proposal: 'run a district pilot with clearly labelled bins', personal: 'once mixed up the date of a meeting', popularity: 'a residents’ poll produced 74 percent support', chain: 'every mistake will immediately be punished with a fine', sample: 'one courtyard was inspected after a holiday', before: 'the share of mixed waste decreased', after: 'the new bins had been installed one month earlier', extreme: 'ban people from buying packaged goods', celebrity: 'a famous chef', tradition: 'all rubbish has always gone into one bin', sunk: 'the old bins were recently repainted', component: 'each instruction was understood by test participants' },
  },
  {
    id: 'energy',
    ru: { title: 'общественная солнечная станция', actor: 'энергетический экономист', proposal: 'создать небольшой кооперативный пилот с открытой отчётностью', personal: 'не умеет чинить бытовую проводку', popularity: 'идея победила в интернет-опросе', chain: 'вся энергосистема станет зависеть только от солнца', sample: 'изучили счета двух домов за летний месяц', before: 'платежи участников снизились', after: 'станцию подключили кварталом раньше', extreme: 'отключить всех жителей от общей сети', celebrity: 'популярный хоккеист', tradition: 'электричество всегда покупали у одного поставщика', sunk: 'в прежний генератор уже вложено много денег', component: 'каждая отдельная панель выдаёт расчётную мощность' },
    en: { title: 'community solar power', actor: 'an energy economist', proposal: 'create a small cooperative pilot with open reporting', personal: 'cannot repair domestic wiring', popularity: 'the idea won an online poll', chain: 'the whole energy system will depend only on sunlight', sample: 'bills from two homes in one summer month were studied', before: 'participants’ payments decreased', after: 'the station had connected one quarter earlier', extreme: 'disconnect every resident from the common grid', celebrity: 'a popular hockey player', tradition: 'electricity has always been bought from one supplier', sunk: 'a lot of money has already gone into the old generator', component: 'each individual panel produces its rated output' },
  },
]

const families = [
  {
    id: 'ad-hominem', difficulty: 1,
    label: { ru: 'Переход на личность', en: 'Ad hominem' },
    explanation: { ru: 'Личные качества автора не опровергают его предложение. Проверять нужно данные и ход рассуждения.', en: 'A personal trait does not refute the proposal. The evidence and reasoning must be assessed instead.' },
    build: (t, l) => l === 'ru'
      ? [`На обсуждении темы «${t.title}» ${t.actor} предложил: «${t.proposal}».`, `Оппонент заявил: «Он ${t.personal}, поэтому его предложение заведомо неверно».`, 'После реплики обсуждение продолжилось.']
      : [`During a discussion of ${t.title}, ${t.actor} proposed to ${t.proposal}.`, `An opponent replied: “This person ${t.personal}, so the proposal must be wrong.”`, 'The discussion continued after the remark.'],
    correctIndex: 1,
  },
  {
    id: 'bandwagon', difficulty: 1,
    label: { ru: 'Апелляция к большинству', en: 'Appeal to popularity' },
    explanation: { ru: 'Популярность показывает отношение людей, но сама по себе не доказывает истинность или эффективность решения.', en: 'Popularity describes people’s attitudes, but it does not by itself prove that a claim is true or a policy effective.' },
    build: (t, l) => l === 'ru'
      ? [`По теме «${t.title}» провели открытый опрос: ${t.popularity}.`, 'Организатор заключил: «Раз большинство согласно, решение обязательно правильное».', `Предложение звучало так: «${t.proposal}».`]
      : [`An open poll on ${t.title} reported that ${t.popularity}.`, 'The organizer concluded: “Because most people agree, the decision must be correct.”', `The proposal was to ${t.proposal}.`],
    correctIndex: 1,
  },
  {
    id: 'false-dilemma', difficulty: 1,
    label: { ru: 'Ложная дилемма', en: 'False dilemma' },
    explanation: { ru: 'Рассуждение искусственно оставляет только два варианта и не проверяет промежуточные или альтернативные решения.', en: 'The reasoning artificially limits the choice to two options without examining intermediate or alternative solutions.' },
    build: (t, l) => l === 'ru'
      ? [`Комиссия обсуждала тему «${t.title}».`, `Председатель сказал: «Либо мы прямо сейчас решаем ${t.proposal}, либо навсегда отказываемся от любых действий».`, 'Участникам не показали перечень других вариантов.']
      : [`The committee discussed ${t.title}.`, `The chair said: “Either we ${t.proposal} right now, or we abandon all action forever.”`, 'No list of other options was shown to participants.'],
    correctIndex: 1,
  },
  {
    id: 'slippery-slope', difficulty: 2,
    label: { ru: 'Скользкий склон', en: 'Slippery slope' },
    explanation: { ru: 'Цепочка неизбежных последствий заявлена без доказательства каждого перехода.', en: 'A chain of supposedly inevitable consequences is asserted without evidence for each step.' },
    build: (t, l) => l === 'ru'
      ? [`Поступило предложение: «${t.proposal}».`, `Критик ответил: «Если сделать первый шаг, затем неизбежно ${t.chain}, а после этого система разрушится».`, 'Вероятность и причинные связи промежуточных шагов не оценивали.']
      : [`A proposal was made to ${t.proposal}.`, `A critic replied: “If we take the first step, then inevitably ${t.chain}, and after that the whole system will collapse.”`, 'Neither the probability nor the causal links between the steps were assessed.'],
    correctIndex: 1,
  },
  {
    id: 'hasty-generalization', difficulty: 1,
    label: { ru: 'Поспешное обобщение', en: 'Hasty generalization' },
    explanation: { ru: 'Маленькая или смещённая выборка не позволяет переносить вывод на всех участников.', en: 'A small or biased sample does not justify a conclusion about the whole population.' },
    build: (t, l) => l === 'ru'
      ? [`Для оценки темы «${t.title}» ${t.sample}.`, 'На основании этого объявили: «Все жители думают одинаково, поэтому дополнительное исследование не нужно».', `Обсуждалось предложение: «${t.proposal}».`]
      : [`To assess ${t.title}, ${t.sample}.`, 'On that basis, officials announced: “Every resident thinks the same, so no further study is needed.”', `The proposal was to ${t.proposal}.`],
    correctIndex: 1,
  },
  {
    id: 'post-hoc', difficulty: 2,
    label: { ru: 'После этого — значит вследствие этого', en: 'Post hoc' },
    explanation: { ru: 'Последовательность событий ещё не доказывает причинную связь. Нужны контроль других факторов и сравнение.', en: 'One event following another does not prove causation. Other factors and a comparison are needed.' },
    build: (t, l) => l === 'ru'
      ? [`В отчёте сказано: «${t.after}».`, `Затем наблюдатели заметили, что ${t.before}.`, 'Авторы заключили: «Первое событие точно вызвало второе, других причин быть не может».']
      : [`The report stated that ${t.after}.`, `Observers then noticed that ${t.before}.`, 'The authors concluded: “The first event definitely caused the second; there can be no other cause.”'],
    correctIndex: 2,
  },
  {
    id: 'circular-reasoning', difficulty: 2,
    label: { ru: 'Круг в доказательстве', en: 'Circular reasoning' },
    explanation: { ru: 'Вывод повторён другими словами и использован как собственное доказательство.', en: 'The conclusion is restated in different words and used as its own evidence.' },
    build: (t, l) => l === 'ru'
      ? [`Докладчик назвал решение по теме «${t.title}» надёжным.`, 'На вопрос о доказательствах он ответил: «Оно надёжно, потому что это решение, на которое можно положиться; положиться на него можно, потому что оно надёжно».', `Речь шла о предложении: «${t.proposal}».`]
      : [`A presenter called the solution for ${t.title} reliable.`, 'Asked for evidence, the presenter replied: “It is reliable because it can be relied upon, and it can be relied upon because it is reliable.”', `The proposal was to ${t.proposal}.`],
    correctIndex: 1,
  },
  {
    id: 'straw-man', difficulty: 2,
    label: { ru: 'Подмена тезиса', en: 'Straw man' },
    explanation: { ru: 'Оппонент заменил ограниченное предложение более радикальной версией и спорит уже с ней.', en: 'The opponent replaced a limited proposal with a more extreme claim and attacked that substitute.' },
    build: (t, l) => l === 'ru'
      ? [`Исходное предложение: «${t.proposal}».`, `Оппонент пересказал его так: «Авторы хотят ${t.extreme}».`, 'В исходном тексте такого требования не было.']
      : [`The original proposal was to ${t.proposal}.`, `An opponent restated it as: “The authors want to ${t.extreme}.”`, 'The original text contained no such requirement.'],
    correctIndex: 1,
  },
  {
    id: 'false-authority', difficulty: 1,
    label: { ru: 'Неподходящий авторитет', en: 'Irrelevant authority' },
    explanation: { ru: 'Известность человека вне нужной области не заменяет профильные данные и аргументы.', en: 'Fame outside the relevant field cannot replace subject-matter evidence and reasoning.' },
    build: (t, l) => l === 'ru'
      ? [`${t.celebrity} публично поддержал тему «${t.title}».`, 'Организаторы заявили: «Раз знаменитость это одобряет, техническая проверка больше не нужна».', `План предполагал: «${t.proposal}».`]
      : [`${t.celebrity} publicly supported ${t.title}.`, 'The organizers said: “Because a celebrity approves, no technical review is needed.”', `The plan was to ${t.proposal}.`],
    correctIndex: 1,
  },
  {
    id: 'tradition', difficulty: 1,
    label: { ru: 'Апелляция к традиции', en: 'Appeal to tradition' },
    explanation: { ru: 'Длительность практики не доказывает, что она остаётся лучшей при новых условиях.', en: 'The age of a practice does not prove that it remains the best option under current conditions.' },
    build: (t, l) => l === 'ru'
      ? [`По теме «${t.title}» отметили: ${t.tradition}.`, 'Из этого сделали вывод: «Старый порядок верен именно потому, что он старый, и сравнивать варианты не требуется».', `Альтернатива была такой: «${t.proposal}».`]
      : [`Regarding ${t.title}, participants noted that ${t.tradition}.`, 'They concluded: “The old approach is correct precisely because it is old, so alternatives need not be compared.”', `The alternative was to ${t.proposal}.`],
    correctIndex: 1,
  },
  {
    id: 'sunk-cost', difficulty: 2,
    label: { ru: 'Ошибка невозвратных затрат', en: 'Sunk-cost fallacy' },
    explanation: { ru: 'Уже потраченные ресурсы нельзя вернуть. Решение нужно сравнивать по будущим издержкам и результатам.', en: 'Past spending cannot be recovered. The decision should compare future costs and outcomes.' },
    build: (t, l) => l === 'ru'
      ? [`Комиссии сообщили: ${t.sunk}.`, 'Председатель решил: «Даже если новый вариант безопаснее и дешевле, мы обязаны продолжать старый только из-за уже потраченных денег».', `Новое предложение: «${t.proposal}».`]
      : [`The committee was told that ${t.sunk}.`, 'The chair decided: “Even if the new option is safer and cheaper, we must continue the old one solely because of money already spent.”', `The new proposal was to ${t.proposal}.`],
    correctIndex: 1,
  },
  {
    id: 'equivocation', difficulty: 3,
    label: { ru: 'Подмена значения слова', en: 'Equivocation' },
    explanation: { ru: 'Одно и то же слово незаметно используется в разных значениях, поэтому вывод не следует из посылки.', en: 'The same word silently changes meaning, so the conclusion does not follow from the premise.' },
    build: (t, l) => l === 'ru'
      ? [`Проект по теме «${t.title}» назвали «открытым», имея в виду открытость отчётности.`, 'Критик ответил: «Если проект открытый, значит любой человек обязан получить доступ ко всем служебным данным без ограничений».', 'В споре слово «открытый» стало означать уже отсутствие любых правил доступа.']
      : [`A project on ${t.title} was called “open,” meaning that its reporting was open.`, 'A critic replied: “If the project is open, everyone must have unrestricted access to all internal data.”', 'During the argument, “open” silently changed to mean the absence of all access rules.'],
    correctIndex: 1,
  },
  {
    id: 'composition', difficulty: 2,
    label: { ru: 'Ошибка композиции', en: 'Fallacy of composition' },
    explanation: { ru: 'Свойство отдельных частей не всегда переносится на систему целиком: взаимодействие частей тоже важно.', en: 'A property of individual parts does not always carry over to the whole system; interactions also matter.' },
    build: (t, l) => l === 'ru'
      ? [`При проверке выяснили: ${t.component}.`, 'Руководитель заключил: «Раз каждая часть хороша отдельно, вся система в любом сочетании обязательно будет эффективной».', `Система должна была помочь теме «${t.title}».`]
      : [`The review found that ${t.component}.`, 'The manager concluded: “Because every part is good on its own, the whole system must be effective in any combination.”', `The system concerned ${t.title}.`],
    correctIndex: 1,
  },
  {
    id: 'base-rate', difficulty: 3,
    label: { ru: 'Игнорирование базовой частоты', en: 'Base-rate neglect' },
    explanation: { ru: 'Точность проверки нельзя превращать в вероятность события без учёта того, насколько часто событие встречается изначально.', en: 'A test’s accuracy cannot be treated as the probability of an event without considering how common the event was beforehand.' },
    build: (t, l) => l === 'ru'
      ? [`Автоматическая проверка по теме «${t.title}» правильно распознаёт 95% известных отклонений.`, 'Серьёзное отклонение встречается примерно в одном случае из ста.', 'После положительного сигнала заявили: «Вероятность реальной проблемы теперь ровно 95%».']
      : [`An automated check for ${t.title} recognizes 95 percent of known anomalies.`, 'A serious anomaly occurs in about one case out of one hundred.', 'After a positive alert, officials said: “The probability of a real problem is now exactly 95 percent.”'],
    correctIndex: 2,
  },
  {
    id: 'survivorship', difficulty: 3,
    label: { ru: 'Ошибка выжившего', en: 'Survivorship bias' },
    explanation: { ru: 'Анализ только успешных случаев скрывает неудачи и искажает оценку вероятности успеха.', en: 'Looking only at successful cases hides failures and distorts the estimated chance of success.' },
    build: (t, l) => l === 'ru'
      ? [`Для оценки темы «${t.title}» собрали отчёты только тех районов, где проект успешно завершился.`, 'По этим отчётам объявили: «Подобные проекты всегда успешны; неудачные случаи можно не учитывать».', `Обсуждалось предложение: «${t.proposal}».`]
      : [`To evaluate ${t.title}, reviewers collected reports only from districts where the project succeeded.`, 'They announced: “Projects like this always succeed; failed cases can be ignored.”', `The proposal was to ${t.proposal}.`],
    correctIndex: 1,
  },
]

export const logicChallenges = families.flatMap((family, familyIndex) => topics.map((topic, topicIndex) => ({
  id: `logic-${String(familyIndex * topics.length + topicIndex + 1).padStart(3, '0')}-v1`,
  family: family.id,
  difficulty: family.difficulty,
  label: family.label,
  explanation: family.explanation,
  segments: { ru: family.build(topic.ru, 'ru'), en: family.build(topic.en, 'en') },
  correctIndex: family.correctIndex,
})))

if (logicChallenges.length !== 150 || new Set(logicChallenges.map((item) => item.id)).size !== 150) {
  throw new Error('logic_challenge_catalog_invalid')
}
const challengeById = new Map(logicChallenges.map((challenge) => [challenge.id, challenge]))

export function getLogicChallenge(id) {
  return challengeById.get(id) ?? null
}

export function presentLogicChallenge(challenge, lang = 'ru') {
  const locale = lang === 'en' ? 'en' : 'ru'
  return {
    id: challenge.id,
    category: challenge.family,
    categoryLabel: challenge.label[locale],
    difficulty: challenge.difficulty,
    segments: challenge.segments[locale],
  }
}

export function scoreLogicAnswer(challenge, selectedIndex, lang = 'ru') {
  const locale = lang === 'en' ? 'en' : 'ru'
  const correct = selectedIndex === challenge.correctIndex
  return {
    correct,
    correctIndex: challenge.correctIndex,
    points: correct ? challenge.difficulty * 10 : 0,
    explanation: challenge.explanation[locale],
  }
}
