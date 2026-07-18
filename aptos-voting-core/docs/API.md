# Контрактный интерфейс

Адрес модуля ниже обозначен как `$MODULE_ADDRESS`. Все веса хранятся в fixed point: `1.0 = 1_000_000` (`weight_scale()`). Квоты и доли бюллетеня задаются в basis points: `10000 = 100%`.

## Управление

- `initialize(creator)` — создаёт ресурс, категорию `0 / General` и совет `1-of-1`.
- `add_admin(creator, admin)` / `remove_admin(creator, admin)` — bootstrap-управление советом. Только создатель.
- `create_category(admin, name, metadata_uri, metadata_hash, q0, q1, q2, q3, floor0, floor1, floor2, floor3, max_individual_weight)` — создаёт категорию и её первую политику.
- `set_category_active(admin, category_id, active, metadata_hash)` — включает или выключает категорию.

## Политики и квалификации

- `propose_policy_change(admin, category_id, q0, q1, q2, q3, floor0, floor1, floor2, floor3, max_individual_weight, evidence_hash, reason_uri, lifetime_secs)`.
- `approve_policy_change(admin, proposal_id)`.
- `propose_qualification(admin, account, category_id, level, eligible, evidence_hash, manual_weight, reason_uri, lifetime_secs)`.
- `approve_qualification(admin, proposal_id)`.

`level` находится в диапазоне `0..3`. `manual_weight = 0` означает автоматический расчёт. Ненулевое значение является публичным исключением и не может превышать cap или пул уровня. Автор предложения сразу считается первым одобрившим; при одном администраторе оно исполняется той же транзакцией.

## Голосование

- `create_election(admin, category_id, metadata_hash, metadata_uri, starts_at_secs, ends_at_secs, pass_bps, quorum_bps, allow_revote)` — создаёт неизменяемый snapshot политики, состава групп и весов. Кворум задаётся в basis points от `eligible_total` снапшота (`0` = значение по умолчанию 4000 = 40%); значения выше `10000` отклоняются.
- `cast_vote(voter, election_id, yes_bps, no_bps, abstain_bps)` — записывает голос или его новую ревизию. Сумма частей должна быть `10000`. К весу экспертов (уровни 1–3) применяется деградация: множитель `0.85` за каждые полные полгода с момента последнего подтверждения квалификации, отсчитанные к началу голосования. Вес не опускается ниже `max(floor уровня, 1.0)` и никогда не превышает вес снапшота. Уровень 0 не деградирует.
- `finalize(caller, election_id)` — после дедлайна фиксирует результат; вызвать может любой аккаунт.

## View-функции

- состояние: `is_initialized`, `weight_scale`, `creator`, `admins`, `admin_threshold`, `is_admin`, `versions`, `counters`;
- управление: `admin_change`, `category`, `category_policy`, `category_change`;
- квалификации: `current_qualification`, `qualification_at_version`, `qualification_proposal`, `qualification_change`;
- политики: `policy_proposal`, `policy_change`;
- голосования: `election`, `election_snapshot`, `election_tallies`, `election_result`, `vote_of`, `vote_revision`, `voting_weight_preview`, `degradation_params`.

Все перечисленные функции аннотированы `#[view]` и доступны через view-endpoint любой фуллноды: независимая проверка не требует собственного Move-кода. `voting_weight_preview(election_id, voter)` возвращает `(eligible, weight, multiplier_bps)` — эффективный вес с учётом деградации до подачи голоса. `vote_of` возвращает также `multiplier_bps`; `vote_revision` хранит только вытесненные переголосованием бюллетени и содержит `replaced_at_secs`.

`versions()` возвращает `council_epoch`, глобальную версию политики и `membership_version`. `counters()` даёт верхние границы ID, поэтому историю можно обойти без доверия к индексатору сайта.

## События

Контракт публикует события инициализации, изменений администраторов/категорий, предложений и исполнения политик/квалификаций, создания голосования, каждого голоса и финализации. Каноническая история также хранится в таблицах; события нужны для быстрого индексирования.
