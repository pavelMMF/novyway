# Подключения production-сайта

## Границы

UI не должен импортировать Aptos SDK напрямую. Экран вызывает read/write gateway, а реализация выбирается runtime-режимом.

```text
React screens → domain/store → read gateway → Aptos RPC/indexer
                           → write gateway → wallet или sponsored relayer
                           → product API → profiles/documents/exams/graphs
```

## Переменные окружения

```env
VITE_RUNTIME_MODE=demo
VITE_APTOS_NETWORK=testnet
VITE_APTOS_MODULE_ADDRESS=
VITE_PUBLIC_API_BASE_URL=
```

## Минимальные backend endpoints

- `GET /api/health` — RPC, индексатор, relayer;
- `GET /api/elections`, `GET /api/elections/:id`;
- `GET /api/documents`, `GET /api/documents/:id`;
- `POST /api/documents`, `PATCH /api/documents/:id/topics`;
- `GET/POST /api/topics`;
- `GET/POST /api/graph-spaces`;
- `POST /api/document-relations`;
- `GET/PATCH /api/me`;
- `GET/POST /api/exams`;
- `POST /api/aptos/sponsored/vote`;
- `GET /api/tx/:hash`.

## Где хранить данные

- Aptos: администраторы, политики весов, квалификационные revisions, снимки, голосования, бюллетени, hashes и события;
- backend database: профиль, почта, Telegram, темы, граф-пространства, экзаменационные материалы;
- object storage/IPFS: полные версии документов;
- on-chain metadata: URI и хеш документа, чтобы любой наблюдатель мог проверить соответствие.

## Состояния транзакции

UI должен показывать `draft → signing → submitted → confirmed/failed`. После подтверждения экран перечитывает данные через gateway; локально нарисованный успех не считается доказательством.

## Реализованное чтение Aptos Testnet

- `aptosReadGateway.ts` вызывает публичные функции просмотра модуля `weighted_voting` через REST-узел Aptos.
- Одно обновление закрепляется на одной версии реестра: счётчики, категории, снимки и итоги нельзя случайно собрать из соседних состояний сети.
- Экраны голосований, карточка голосования, состояние сети и обзор используют типизированную модель `LiveVotingState`, а не сырые массивы Move.
- Аудит повторно загружает известные транзакции по их хэшам, проверяет успешность и строит ссылки на конкретные записи в Aptos Explorer.
- Журнал известных транзакций не является полным индексом сети. Для автоматического обнаружения всех будущих событий потребуется серверный индексатор или обновляемый публичный манифест.
- Архив документов проверяет SHA-256 в браузере и ведёт на конкретную транзакцию публикации каждого документа.
- В браузерной сборке нет приватного ключа, кошелька или серверного подписанта. Подача реального голоса остаётся отдельным этапом интеграции.
