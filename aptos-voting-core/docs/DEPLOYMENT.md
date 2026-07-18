# Публикация в Aptos

Сначала выполните полный цикл в Testnet. Mainnet фиксирует адрес модуля и расходует реальный APT.

## 1. CLI и локальная проверка

```powershell
iwr "https://aptos.dev/scripts/install_cli.ps1" -UseBasicParsing | iex
aptos --version

aptos move compile --named-addresses aptos_voting=0x42 --fail-on-warning
aptos move test --named-addresses aptos_voting=0x42 --coverage --fail-on-warning
```

Для текущей версии ожидается `21 passed, 0 failed` и coverage около `69.67%`.

## 2. Testnet-профиль

```powershell
aptos init --network testnet --profile voting-testnet
aptos config show-profiles --profile voting-testnet
aptos account fund-with-faucet --profile voting-testnet --amount 100000000
$MODULE_ADDRESS = "0xВАШ_TESTNET_АДРЕС"
```

`.aptos/config.yaml` содержит приватный ключ и не должен попадать в Git.

## 3. Сборка, симуляция и публикация

```powershell
aptos move compile --named-addresses "aptos_voting=$MODULE_ADDRESS" --fail-on-warning

aptos move publish `
  --profile voting-testnet `
  --named-addresses "aptos_voting=$MODULE_ADDRESS" `
  --included-artifacts sparse `
  --local

aptos move publish `
  --profile voting-testnet `
  --named-addresses "aptos_voting=$MODULE_ADDRESS" `
  --included-artifacts sparse `
  --assume-yes
```

Сохраните transaction hash. Адрес входит в bytecode: пакет нельзя собрать под `0x42` и опубликовать с другого адреса.

## 4. Инициализация

```powershell
aptos move run `
  --profile voting-testnet `
  --function-id "$MODULE_ADDRESS::weighted_voting::initialize" `
  --assume-yes

aptos move view `
  --profile voting-testnet `
  --function-id "$MODULE_ADDRESS::weighted_voting::admin_threshold"
```

Ожидаемый порог: `1`.

## 5. Категория с четырьмя уровнями

Веса используют scale `1_000_000`. Пример ниже создаёт категорию «Экономика» с квотами `25/15/25/35%`, нулевыми floors и cap `25.0`.

```powershell
$CATEGORY = "Экономика"
$CATEGORY_HEX = [Convert]::ToHexString([Text.Encoding]::UTF8.GetBytes($CATEGORY)).ToLowerInvariant()
$CATEGORY_URI = "https://example.org/categories/economics.json"
$CATEGORY_URI_HEX = [Convert]::ToHexString([Text.Encoding]::UTF8.GetBytes($CATEGORY_URI)).ToLowerInvariant()
$CATEGORY_HASH = (Get-FileHash -LiteralPath ".\economics-category.json" -Algorithm SHA256).Hash.ToLowerInvariant()

aptos move run `
  --profile voting-testnet `
  --function-id "$MODULE_ADDRESS::weighted_voting::create_category" `
  --args "hex:$CATEGORY_HEX" "hex:$CATEGORY_URI_HEX" "hex:$CATEGORY_HASH" `
         "u64:2500" "u64:1500" "u64:2500" "u64:3500" `
         "u64:0" "u64:0" "u64:0" "u64:0" "u64:25000000" `
  --assume-yes
```

Новая категория получает `category_id = 1` в чистом деплое.

## 6. Назначение уровня пользователю

`manual_weight = 0` включает автоматический расчёт. `lifetime_secs` — длительность предложения, а не Unix timestamp. При совете `1-of-1` предложение сразу исполняется.

```powershell
$VOTER = "0xАДРЕС_ПОЛЬЗОВАТЕЛЯ"
$EVIDENCE_HASH = (Get-FileHash -LiteralPath ".\exam-result.json" -Algorithm SHA256).Hash.ToLowerInvariant()
$REASON_URI = "https://example.org/evidence/exam-001.json"
$REASON_URI_HEX = [Convert]::ToHexString([Text.Encoding]::UTF8.GetBytes($REASON_URI)).ToLowerInvariant()

aptos move run `
  --profile voting-testnet `
  --function-id "$MODULE_ADDRESS::weighted_voting::propose_qualification" `
  --args "address:$VOTER" "u64:1" "u8:0" "bool:true" `
         "hex:$EVIDENCE_HASH" "u64:0" "hex:$REASON_URI_HEX" "u64:86400" `
  --assume-yes
```

До создания голосования в категории должен существовать хотя бы один eligible-пользователь `L0`. Для реальной демонстрации добавьте все аккаунты и уровни. При нескольких администраторах остальные вызывают:

```powershell
aptos move run `
  --profile second-admin-testnet `
  --function-id "$MODULE_ADDRESS::weighted_voting::approve_qualification" `
  --args "u64:ID_ПРЕДЛОЖЕНИЯ" `
  --assume-yes
```

Проверка:

```powershell
aptos move view `
  --profile voting-testnet `
  --function-id "$MODULE_ADDRESS::weighted_voting::current_qualification" `
  --args "address:$VOTER" "u64:1"
```

## 7. Изменение квот

Публикуется отдельной версией и также проходит большинство совета:

```powershell
aptos move run `
  --profile voting-testnet `
  --function-id "$MODULE_ADDRESS::weighted_voting::propose_policy_change" `
  --args "u64:1" "u64:2500" "u64:1500" "u64:2500" "u64:3500" `
         "u64:0" "u64:0" "u64:0" "u64:0" "u64:25000000" `
         "hex:$EVIDENCE_HASH" "hex:$REASON_URI_HEX" "u64:86400" `
  --assume-yes
```

## 8. Создание голосования

Сначала добавьте минимум один `L0`; иначе snapshot намеренно отклоняется. Метаданные должны содержать документ, пункт, старый/новый текст и их хеши.

```powershell
$NOW = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$START = $NOW + 60
$END = $START + 86400
$METADATA_HASH = (Get-FileHash -LiteralPath ".\election.json" -Algorithm SHA256).Hash.ToLowerInvariant()
$METADATA_URI = "https://example.org/elections/election-001.json"
$METADATA_URI_HEX = [Convert]::ToHexString([Text.Encoding]::UTF8.GetBytes($METADATA_URI)).ToLowerInvariant()

aptos move run `
  --profile voting-testnet `
  --function-id "$MODULE_ADDRESS::weighted_voting::create_election" `
  --args "u64:1" "hex:$METADATA_HASH" "hex:$METADATA_URI_HEX" `
         "u64:$START" "u64:$END" "u64:5000" "u64:0" "bool:true" `
  --assume-yes

aptos move view `
  --profile voting-testnet `
  --function-id "$MODULE_ADDRESS::weighted_voting::election_snapshot" `
  --args "u64:0"
```

## 9. Голос и переголосование

```powershell
aptos move run `
  --profile voter-testnet `
  --function-id "$MODULE_ADDRESS::weighted_voting::cast_vote" `
  --args "u64:0" "u64:2500" "u64:5000" "u64:2500" `
  --assume-yes
```

Повторный вызов заменяет текущий вклад, если `allow_revote = true`, но сохраняет старую ревизию.

## 10. Финализация и Explorer

После `$END`:

```powershell
aptos move run `
  --profile voting-testnet `
  --function-id "$MODULE_ADDRESS::weighted_voting::finalize" `
  --args "u64:0" `
  --assume-yes

aptos move view `
  --profile voting-testnet `
  --function-id "$MODULE_ADDRESS::weighted_voting::election_result" `
  --args "u64:0"
```

Explorer: `https://explorer.aptoslabs.com/account/$MODULE_ADDRESS/modules?network=testnet`.

## 11. Mainnet

```powershell
aptos init --network mainnet --profile voting-mainnet --skip-faucet
aptos config show-profiles --profile voting-mainnet
```

Используйте новый защищённый аккаунт, повторите сборку/симуляцию с его адресом и пополните APT. До внешнего аудита не делайте пакет immutable. Для серьёзного production upgrade authority должен находиться под multisig/timelock, а не в браузере или обычном backend-процессе.

Официальные материалы: [smart contracts](https://aptos.dev/build/smart-contracts), [deployment](https://aptos.dev/build/smart-contracts/deployment), [sponsored transactions](https://aptos.dev/build/guides/sponsored-transactions), [Keyless Accounts](https://aptos.dev/build/guides/aptos-keyless/introduction).
