# Phase 2 Quality Audit

Дата: 13 ноября 2026.  
Прод, секреты, Clerk, Stripe, домен, `AI_PROVIDER` и production migration не менялись. Phase 3 не начата.

## Executive Summary

Сделана серверная модель участия в workspace: владелец, роли, инвайт-код без письма, отказ по умолчанию и один и тот же ответ 404 для чужого и несуществующего объекта. Старый доступ к мониторам по `userId` и Team не заменялся.

Локальные тесты авторизации, повтор Phase 1, plan rules, scheduler и production build прошли. В браузере локальный оператор создал workspace и увидел роль OWNER. POST `/api/workspaces` вернул 201.

Открытых P0, P1 и P2 нет. Вердикт: **PASS**.

## Architecture Review

`Team` оставлен отдельной системой шаринга мониторов. Workspace membership его не читает и не мигрирует. Вход по-прежнему Clerk через `requireUser`.

Владелец хранится в `Workspace.ownerId` и дублируется строкой `WorkspaceMember` с ролью OWNER, чтобы списки и проверки смотрели в одно место. Смена владельца обычным PATCH невозможна: схема тела строгая и принимает только `name`, а триггер базы отклоняет UPDATE `ownerId`.

## Ownership Implementation

`createWorkspace` в одной транзакции создаёт workspace и membership OWNER. Тест `creating a workspace also records the owner` прошёл. Прямой `prisma.workspace.update` на `ownerId` получил исключение `owner cannot be changed`.

Чужой пользователь не читает, не переименовывает и не удаляет workspace: три вызова вернули `ApiError` 404.

## Membership Implementation

Уникальный индекс `(workspaceId, userId)` отклонил повторную вставку. Инвайт — случайный код `wfws_`, в базе только SHA-256. Роль OWNER у инвайта запрещена CHECK-ограничением. Повторное использование кода другим пользователем вернуло 404.

Письма не отправлялись. Новые пользователи кодом не создаются: погасить код может только уже существующий вошедший аккаунт.

Снятие admin прекратило чтение workspace и клиента. Снятие member ждало освобождения `FOR UPDATE` по строке workspace не меньше 650 мс и только потом удалило строку.

## Roles & Permissions

Проверено функциями `roleAllows`, `canGrantWorkspaceRole`, `canRemoveWorkspaceMember` и сценариями базы:

- MEMBER не удаляет workspace и не назначает себе OWNER.
- VIEWER не переименовывает workspace.
- ADMIN переименовывает, не удаляет workspace, не меняет роль владельца и не снимает другого ADMIN.
- OWNER снимает ADMIN. База отдельно отвергает вторую роль OWNER.

## Authorization Layer

`src/lib/tenancy.ts` — чистые правила. `src/lib/workspace-access.ts` — доступ к базе. `requireWorkspacePermission` сначала блокирует строку workspace, затем решает роль: `ownerId` всегда OWNER, иначе строка membership. Нет строки — 404, даже если роль слишком слабая для операции.

Запрос данных идёт с `workspaceId` из уже проверенной строки, не из непроверенного тела.

## API Authorization Matrix

Подробности в `PHASE_2_API_AUTHORIZATION_MATRIX.md`. Новые маршруты собрались: build показывает `/api/workspaces`, `/api/workspaces/[id]`, members, invites и join.

Старые `/api/monitors` и `/api/teams` не переведены на workspace. Монитор, привязанный к workspace, по-прежнему находится проверкой `userId` владельца записи.

## Tenant Isolation Review

Два пользователя в одном тесте. Stranger не видит workspace в списке. Outsider и снятый участник не читают монитор workspace. Снятый участник не читает клиента. Неизвестный id и чужой id дают один и тот же 404.

Старый монитор `https://example.com` остался с пустыми `workspaceId` и `clientId`.

## Security Threat Model

Таблица сценариев и доказательств: `PHASE_2_SECURITY_THREAT_MODEL.md`.

## Database Review

Миграция `prisma/migrations/20261113180000_workspace_membership/migration.sql` применена локально через `prisma db execute`. Повторных объектов она избегает.

Ограничения: уникальная пара участника, внешние ключи на workspace и user с CASCADE, CHECK что инвайт не OWNER, триггеры несменяемого владельца, запрета чужого OWNER, запрета понижения и удаления владельца. Удаление самого workspace помечается локальной настройкой транзакции, иначе каскад не смог бы снять строку владельца.

## Migration Review

Vercel по-прежнему запускает `npm run build` и миграцию не применяет. Прод этой миграцией не обновлялся. `db push` на прод не запускался.

Порядок тот же, что в Phase 1: сначала оператор применяет SQL к продовой базе, потом выкатывается код. Откат схемы не предлагается. Если новый деплой упадёт после миграции, старый код не читает `WorkspaceMember` и продолжает работать. Пустые таблицы membership ничего не меняют в старых мониторах.

## Clerk Compatibility

Нового провайдера входа нет. Маршруты вызывают существующий `requireUser`. Локальная проверка UI шла под локальной dev-сессией без ключей Clerk. Продакшен-сессия Clerk в этом прогоне не использовалась.

## Team Sharing Compatibility

Файлы `/api/teams` не менялись. Workspace их не вызывает. Тест Team в этом прогоне не повторялся: код Team не затронут. Это не новое доказательство Team, а отсутствие изменений в его маршрутах.

## Backward Compatibility

Фиктивные workspace для старых пользователей не создавались. Мониторы не переносились. Планировщик и fetch не читают membership: grep по `src/lib/monitoring` не нашёл `workspaceId`, кроме несвязанного `clientId` eBay.

Удаление workspace очистило связи тестового монитора и оставило snapshot и change.

## Frontend Review

В настройках секция Workspaces. Она показывает только ответ `GET /api/workspaces`. При выборе другого workspace деталь сначала очищается, затем запрашивается заново.

В браузере на `http://localhost:3000/dashboard/settings` локальный оператор создал workspace. На экране: `Open workspace: North Agency · OWNER`. Сервер записал `POST /api/workspaces 201`.

Полного экрана управления ролями нет. Операции ролей есть в API и покрыты тестами. Это соответствует границе фазы: не строить сложный UI раньше серверной модели.

## Regression Results

В этом прогоне заново прошли:

- `scripts/test-workspace-auth.ts` — все перечисленные проверки, код выхода 0.
- `scripts/test-tenant-foundation.ts` — код выхода 0.
- `scripts/test-plan-rules.ts` — код выхода 0.
- `scripts/test-scheduler-guards.ts` — код выхода 0.

## Integration Test Results

Авторизация проверялась реальными функциями и локальной Postgres, без подмены правил доступа. HTTP-создание workspace проверено браузером и логом сервера. Clerk, Stripe, Resend, Telegram и OpenAI по сети не вызывались.

## Security Test Results

См. threat model. Дополнительно: дубликат membership отклонён базой, второй OWNER отклонён базой, смена `ownerId` отклонена базой, повтор инвайта отклонён.

## Build Results

`npx tsc --noEmit` перед тестами авторизации: код 0.  
`npx next build`: код 0, Next.js 15.5.20, 62 страницы. Линт и типы внутри build прошли. Предупреждение edge runtime было и раньше.

## Skipped Tests

- Живые `test-scrapling-engine`, `test-live-public`, `test-storefront-quality`, `test-monitoring-engine`: сеть и запись `lastCheckedAt`, fetch не менялся.
- Повтор всего набора sources, marketplace, universal, assets: файлы не менялись после Phase 1, в этом прогоне не перезапускались.
- Почта инвайта: намеренно не отправляется.
- Продакшен-миграция и деплой: запрещены заданием.

## Known Issues

P0, P1, P2: нет.

P3: нет.

P4:

- Почтовые приглашения и создание аккаунта из инвайта не делались. Нужно отдельное решение по Clerk и Resend.
- В интерфейсе нет формы смены ролей. Она есть в API.
- `Team` и Workspace по-прежнему две разные модели. Это сознательно.
- Прод не содержит таблицу membership, пока оператор не применит миграцию.

## Remaining Risks

Прямой SQL по-прежнему может записать согласованную пару client/workspace на чужой монитор. HTTP-маршрута для этого нет.

Блокировка строки сериализует снятие участника, но не выбирает «правильную» роль, если два разрешённых владельца когда-нибудь появятся. Сейчас владелец один.

Локальная история `_prisma_migrations` этим прогоном не читалась. SQL применялся через `db execute` и сразу после этого выполнен второй раз: команда завершилась без ошибки. Повтор создаёт объекты через `IF NOT EXISTS` и `duplicate_object`. Это доказано локально, не на проде.

## Changed Files

- `prisma/schema.prisma`
- `prisma/migrations/20261113180000_workspace_membership/migration.sql`
- `src/lib/tenancy.ts`
- `src/lib/workspace-access.ts`
- `src/app/api/workspaces/route.ts`
- `src/app/api/workspaces/join/route.ts`
- `src/app/api/workspaces/[id]/route.ts`
- `src/app/api/workspaces/[id]/members/route.ts`
- `src/app/api/workspaces/[id]/members/[userId]/route.ts`
- `src/app/api/workspaces/[id]/invites/route.ts`
- `src/components/dashboard/workspace-panel.tsx`
- `src/app/dashboard/settings/page.tsx`
- `scripts/test-workspace-auth.ts`
- `PHASE_2_IMPLEMENTATION_PLAN.md`
- `PHASE_2_API_AUTHORIZATION_MATRIX.md`
- `PHASE_2_SECURITY_THREAT_MODEL.md`
- `PHASE_2_QUALITY_AUDIT.md`

## Final Verdict

**PASS**

P0: 0. P1: 0. P2: 0. P3: 0. P4 задокументированы.

Phase 3 не начата. Production migration не запускалась.
