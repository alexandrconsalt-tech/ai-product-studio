# Conversation Judge v5.2.2 — production regression

Все отчёты получены через production Pipeline Lab `AI Summary 10.08` после
деплоя `dpl_3KERFz8VVhqSHZ3RqhE3CZGCUSag`.

- `case-1-evening-callback.json` — звонок агента сегодня вечером.
- `case-2-approximate-30-40-minutes.json` — сообщение агента примерно через 30–40 минут.
- `case-3-viewing-and-friday-call.json` — просмотр в субботу 10:30 и звонок агента в пятницу.

Во всех трёх отчётах Conversation Judge имеет `stage_version: v5.2.2`,
`prompt_version: v5`; поля outcome поддержаны и ложные `OUTCOME_*` отсутствуют.
