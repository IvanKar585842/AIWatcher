# Watchflowing — аудит архитектуры (Phase 0)

Дата аудита: 13 ноября 2026.  
Объект: текущий репозиторий Watchflowing (Next.js 15, Prisma/Postgres, Clerk, Stripe, Scrapling).  
Статус документа: описание факта в коде. Это не план внедрения и не разрешение начинать Phase 1.

Код, миграции, продакшен и данные пользователей в ходе аудита не изменялись.

Эти правила обязательны для всех фаз после аудита. Phase 1 их уже соблюдает: Clerk, Stripe, домен, хостинг и существующие webhook не менялись. Миграция workspace применена только к локальной базе.

---

## Existing Production Infrastructure

Watchflowing уже развёрнут. Новые функции расширяют эту инфраструктуру. Второй проект, второй хостинг и вторые интеграции не создаются.

Фактическая привязка в репозитории:

| Сервис | Где закреплён | Что нельзя делать без отдельного разрешения |
| --- | --- | --- |
| Vercel | `vercel.json`: framework nextjs, `buildCommand` = `npm run build`, `installCommand` = `npm install` | Второй проект, другой hosting, смена домена |
| Домен | `NEXT_PUBLIC_APP_URL` = `https://watchflowing.com` | Менять домен или публичные URL webhook |
| Clerk | `src/lib/auth.ts`, `src/middleware.ts` | Новый auth, переподключение Clerk |
| Stripe | `/api/stripe/webhook`, `/api/webhooks/stripe`, checkout и portal | Вторая платёжная система, смена Price ID и webhook path |
| Resend | `src/lib/notifications/email.ts`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL` | Второй email-провайдер |
| Telegram | `/api/telegram/webhook`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET` | Удалять интеграцию |
| AI | Один pipeline в `src/lib/ai`. Провайдер выбирает уже существующий `AI_PROVIDER` (`openai`, `claude` или `gemini`) | Второй pipeline и смена провайдера на проде |
| База | `DATABASE_URL` и `DIRECT_URL` в Prisma | Новое подключение, `db push` на прод, ручной запуск прод-миграции из этой среды |
| Мониторинг | `MonitorQueue`, cron `/api/cron/monitoring`, worker `scripts/monitor-worker.ts` | Второй scheduler |
| Фронтенд | Тот же Next.js-деплой | Отдельное frontend-приложение |

Cron в `vercel.json` остаётся ежедневным (`0 6 * * *` для мониторинга). Более частый cron на Hobby ломает весь деплой. Менять расписание только отдельным решением.

Скрипт `npm run build` — это `prisma generate && next build`. Он не применяет миграции. Скрипт `vercel-build` с `prisma migrate deploy` в `package.json` есть, но `vercel.json` вызывает именно `npm run build`, поэтому на Vercel миграции сами не выполняются.

### Безопасный порядок миграций

1. Проверить SQL локально и прогнать тесты на локальной базе.
2. Не запускать миграцию против продакшена из агентской сессии.
3. Перед выкладкой кода, который читает новые таблицы, оператор отдельно применяет `prisma migrate deploy` к продовым `DIRECT_URL` / `DATABASE_URL`. Не использовать `db push` на проде.
4. Убедиться, что новые колонки есть, и только потом деплоить код.
5. Если миграция не готова, не выкатывать схему: иначе запросы пользователя падают, а сайт показывает «Dashboard data could not be loaded». Сами мониторы при этом не переписываются.
6. Не встраивать `migrate deploy` в текущий `npm run build`, пока нет отдельного разрешения: сбой миграции на Hobby валит весь деплой.

### Переменные окружения

Секреты не печатаются, не копируются в Markdown и не коммитятся. `.env` остаётся локальным.

Уже используемые имена, которые нужно сохранить: `DATABASE_URL`, `DIRECT_URL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, URL входа Clerk, `NEXT_PUBLIC_APP_URL`, `ADMIN_EMAILS`, `AI_PROVIDER`, `OPENAI_API_KEY`, `OPENAI_MODEL`, `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `GEMINI_API_KEY`, `GEMINI_MODEL`, ключи и Price ID Stripe, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET`, `CRON_SECRET`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, а также серверные ключи Amazon, eBay, Etsy и `MONITOR_WORKER_URL`, если они уже заданы на Vercel.

Новая переменная допустима только после записи, зачем она нужна. Дубликаты существующих имён не заводятся. Значения не удаляются и не переименовываются.

### Что это значит для Workspace

Workspace, клиенты и отчёты агентства живут в том же приложении, той же базе, том же Clerk и том же Stripe. Старые пользователи, подписки, мониторы, сессии и webhook продолжают работать. Новые поля остаются пустыми, пока пользователь сам не создаст workspace.

## Current Architecture

Один Next.js App Router обслуживает сайт, API, cron-роуты и dashboard. Отдельного backend-сервиса нет.

Поток проверки сайта:

1. Расписание ставит монитор в `MonitorQueue`.
2. Cron или локальный worker вызывает `runMonitoringCycle`.
3. `processMonitor` забирает блокировку, уважает интервал тарифа и вызывает `fetchPageContent`.
4. Сначала `tryOfficialSource` / `runSourceCheck` (официальный API, RSS, Shopify, GitHub releases).
5. Если источник не структурный, страница идёт в Scrapling: HTTP, затем браузер только если HTML — пустая JS-оболочка.
6. Успешный результат сравнивается с последним снимком. Ошибка, частичный результат и challenge не перезаписывают последний успешный snapshot.
7. При изменении создаётся `Change`, затем AI-разбор и уведомления.

Идентичность данных сегодня — пользователь (`User`), не агентство. Монитор принадлежит `userId`. Подписка одна на пользователя. `Team` — необязательная надстройка «один владелец и участники», а не клиентская база агентства.

Продакшен-ритм проверок не равен обещанным интервалам тарифа. В `vercel.json` cron мониторинга — раз в сутки (`0 6 * * *`), потому что Hobby отклоняет поминутное расписание и валит весь деплой. GitHub Actions может вызывать cron каждые 5 минут, только если задан `CRON_SECRET`. Интервал в 1 минуту требует отдельный процесс `scripts/monitor-worker.ts` и `MONITOR_WORKER_URL`. `vercel.json` явно задаёт `buildCommand: npm run build`. Этот скрипт делает `prisma generate && next build` и не применяет миграции. Локальный скрипт `vercel-build` с `prisma migrate deploy` при таком `buildCommand` на Vercel не выполняется.

---

## Existing Features

Работает в коде и покрыто фикстурными или живыми тестами там, где это указано.

| Область | Что есть | Ограничение |
| --- | --- | --- |
| Аккаунт | Clerk в проде, локальная сессия без ключей Clerk только в development | Продакшен без Clerk остаётся закрытым |
| Мониторы | Создание, пауза, ручная проверка, история, селекторы, ключевые слова, режимы страницы | Ручная проверка игнорирует интервал; автоматическая — нет |
| Снимки и diff | HTML, текст, основной регион, JSON-LD/microdata, сетка товаров, ссылки, таблицы, хеши файлов, сетка скриншота | Скриншот не является распознаванием DOM-элементов |
| Источники | Webpage, RSS/Atom, news sitemap, GitHub releases, Shopify public catalog, Amazon Creators, eBay Browse, Etsy Open API | Amazon/eBay/Etsy без ключей не падают в браузер. Коммерческое использование этих API не одобрено |
| Каталог магазинов | 328 доменов: official-api или public-page | Запись в каталоге не означает, что сайт открывается. На замере 183 публичных главных: 86 отдали HTML, 81 выглядели как защита |
| AI | Сравнение передаётся в провайдер (OpenAI, Claude или Gemini), есть fallback без модели, важность LOW–CRITICAL, категории включая PRICE и CONTACT_INFO | AI не единственный источник: сырой diff сохраняется. Лимиты запросов есть |
| Уведомления | In-app, email через Resend, Telegram, signed webhook на Business | Email и Telegram с этой машины живьём не подтверждались. Webhook-секрет хранится в `User.webhookSecret` как строка |
| Отчёты | Weekly report, публичная ссылка, agency brand name и «Powered by» | Это отчёт пользователя, не отчёт по клиентам агентства. Monthly и white-label PDF нет |
| Оплата | Stripe checkout, portal, webhook с проверкой подписи, планы FREE / PRO / BUSINESS | Цены и лимиты завязаны на эти три плана. Живой платёж в этом аудите не выполнялся |
| Команда | Одна команда на владельца, инвайт, до 25 участников на Business, шаринг мониторов владельца | Нет клиентов, нет нескольких workspace, участник не владеет биллингом |
| API | `/api/v1/monitors` и `/api/v1/changes` по ключу `wf_`, хеш ключа | Только чтение. Ключ привязан к пользователю, не к workspace |
| Агентский брендинг | `agencyModeEnabled`, `agencyBrandName` на пользователе и в публичном отчёте | Это флаги профиля, не workspace |

Режимы мониторинга в схеме: `ENTIRE_PAGE`, `TEXT_CHANGES`, `CSS_SELECTOR`, `XPATH`, `PRICE_DETECTION`, `KEYWORD_DETECTION`, `VISUAL_CHANGES`, `SCREENSHOT_DIFF`, `HTML_DIFF`, `PRODUCT_AVAILABILITY`, `JOB_LISTINGS`, `DOCUMENTATION_CHANGES`, `API_RESPONSE`, `RSS_FEED`, `TABLE_DETECTION`, `AI_SMART`.

Важность изменения: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`. Отдельного `INFORMATIONAL` нет. Категории уже включают `PRICE`, `CONTENT`, `CONTACT_INFO`, `POLICY`, `PRODUCT`.

---

## Existing Database Structure

Основные таблицы:

- `User` — аккаунт, Clerk id, Telegram, отчёты, agency-поля, webhook URL и секрет.
- `Subscription` — один к одному с пользователем, план FREE/PRO/BUSINESS, Stripe ids.
- `Monitor` — URL, режим, интервал, статус, `userId`, необязательный `teamId`. Уникальность URL внутри пользователя, не внутри агентства.
- `Snapshot` — сырой и очищенный HTML, хеш, текст, JSON metadata.
- `Change` — summary, importance, category, diff, `aiRawResponse`, статус анализа.
- `Notification` — доставка одного change одному пользователю.
- `MonitorAlert` — сбой проверки, без привязки к change.
- `MonitorQueue` — расписание и lock.
- `Team`, `TeamMember`, `TeamInvite` — одна команда на `ownerId`.
- `ApiKey` — хеш ключа пользователя.
- `WeeklyReport`, `ChatConversation`, `AnalyticsEvent`, `IntelligenceScore`, `ProcessedStripeEvent`.

Нет моделей `Workspace`, `Client`, `Website` как отдельной сущности от `Monitor`, `MonitoringProfile`, `SiteToken`, `DomainVerification`, `AuditLog`.

`Monitor.config` — JSON. Туда уже кладутся source type, watch scope и часть поведения без миграции. Это подходящее место для малых флагов, но не для прав доступа.

---

## Existing API Structure

Группы, которые уже есть:

- `/api/monitors` — CRUD, bulk, check, selector probe, compatibility.
- `/api/changes`, `/api/notifications`, `/api/reports`.
- `/api/dashboard/bootstrap` и `/api/dashboard/stats`.
- `/api/cron/monitoring`, `chat-cleanup`, `weekly-reports`. Авторизация cron — bearer `CRON_SECRET`.
- `/api/stripe/*` и `/api/webhooks/stripe` — подпись Stripe.
- `/api/telegram/*` — webhook, link, setup.
- `/api/billing/checkout` и `/api/billing/overview`.
- `/api/user/export`, `/api/user/delete`, webhook, api-keys, access.
- `/api/teams` — create, invite, join, share-all мониторов владельца.
- `/api/v1/*` — чтение по API-ключу, маршрут публичный для Clerk и проверяет ключ сам.
- `/api/public/*`, `/api/status/*` — публичные страницы и бейдж.

Права на монитор: мутации через `assertMonitorOwnedBy` (`userId`). Чтение списка и карточки учитывает членство в команде (`monitorReadFilter`). Это не изоляция арендатора: данные биллинга, чата и отчётов остаются личными.

---

## Reusable Components

Их нельзя дублировать.

- Очередь и scheduler: `src/lib/monitoring/queue.ts`, `scheduler.ts`, `processor.ts`, cron route, `scripts/monitor-worker.ts`.
- Fetch: `fetcher.ts`, `scrapling-adapter.ts`, `scrapling-client.ts`, `render-need.ts`, Python worker. `solve_cloudflare` не включается.
- Сравнение: `compare.ts`, `structured-compare.ts`, `page-profile.ts`, `visual-compare.ts`.
- AI: `ai-processor.ts`, провайдеры, `importance.ts`, `fallback-analysis.ts`.
- Уведомления: `notifications/deliver.ts`, email, telegram, `customer-webhook.ts`, `alert-dedupe.ts`.
- Тарифы: `plan-features.ts`, `plan-guards.ts`. Любой новый лимит должен жить здесь.
- Безопасность URL: `src/lib/security/url.ts` (SSRF, DNS, редиректы).
- Auth: `src/lib/auth.ts`, Clerk middleware.
- Stripe: `stripe.ts`, `stripe-webhook.ts`. Цены не менять до отдельного решения.
- Отчёты: `src/lib/reports/*` и weekly cron. Расширять, не создавать второй генератор.
- Agency-поля пользователя и публичный отчёт — заготовка бренда, не модель клиентов.

---

## Missing Components

Для позиционирования «платформа для веб-агентств» в коде нет:

- Workspace как граница данных и биллинга.
- Клиента агентства и связи «клиент → несколько сайтов».
- Сводного dashboard по клиентам и проблемным сайтам, а не только по мониторам одного пользователя.
- Группировки алертов по клиенту.
- Monthly report и white-label отчёта по портфелю клиентов.
- First-party JS SDK и site token.
- Подтверждения владения доменом.
- Журнала аудита действий сотрудников.
- Тарифов Starter / Agency / Pro. Сейчас FREE / PRO / BUSINESS с другими лимитами.
- Класса важности Informational. Его можно выразить через LOW, отдельное значение не обязательно.
- Проверок «элемент исчез» и «форма сломана» как отдельных продуктов. Селектор и structured diff это частично покрывают, но нет агентского сценария «критичные элементы клиента».

---

## Technical Debt

- Монитор и подписка живут на пользователе. Команда приклеена сбоку и не владеет клиентами.
- `vercel.json` обходит миграции. После коммита со схемой `Team` / `webhookUrl` продовый запрос пользователя может падать, если колонок в базе нет. Локально схема накатывалась через `db push`. Сообщение «Dashboard data could not be loaded» как раз такой симптом: мониторы при этом не изменяются.
- Обещанный интервал тарифа и реальный тик продакшена расходятся. UI это уже говорит (`deployment-schedule.ts`).
- Rate limit без Upstash — память одного инстанса.
- `webhookSecret` хранится в открытом виде в строке пользователя. API-ключи хранятся как SHA-256, это лучше.
- Каталог из 328 магазинов легко принять за покрытие. Замер это опровергает.
- Тесты — скрипты `tsx`, не единый test runner. Часть живая и зависит от сети. Автоматического CI на эти скрипты в репозитории не видно, кроме monitoring tick.
- In-memory lock процесса не заменяет lock в `MonitorQueue` между несколькими инстансами. Очередь это уже учитывает; путать их нельзя.
- Участник команды может читать расшаренные мониторы, но шаринг включает все мониторы владельца сразу (`/api/teams/share`). Для агентства это слишком грубо.

---

## Security Risks

- Нет tenant isolation. Любой новый `client_id` с клиента без проверки workspace даст IDOR. Это главный риск Phase 1.
- Секрет webhook и, при наличии, cookie сессии монитора — чувствительные поля. Cookie уже шифруются отдельным путём. Webhook-секрет — нет.
- Публичные `/api/v1` правильно не доверяют Clerk, но ключ даёт все мониторы пользователя, включая расшаренные командой. Для агентства ключ должен быть ограничен workspace.
- SSRF-проверка есть и её нельзя ослаблять ради «большего процента открытий».
- Challenge и логин не обходятся. Это ограничение продукта, не долг.
- Локальная dev-сессия без Clerk включена только при `NODE_ENV !== production`. Её нельзя расширять на прод.
- Аудит-лога действий нет. `AnalyticsEvent` — продуктовая аналитика, не журнал безопасности.

---

## Architectural Conflicts

1. Текущий `Team` не равен Agency Workspace. У команды нет клиентов, биллинга и изоляции. Расширять её полями `clients` можно, но имя и уникальный `ownerId` мешают нескольким workspace и нескольким владельцам. Безопаснее добавить `Workspace` и позже связать или заменить `Team`, не ломая текущие инвайты в том же релизе.
2. `Monitor.userId` сегодня и владелец данных, и получатель квоты. Если повесить монитор только на workspace, сломаются квоты, удаление аккаунта и уникальность URL. Переходный период: оставить `userId` создателя, добавить `workspaceId` и `clientId`.
3. Тарифы FREE/PRO/BUSINESS уже в Stripe metadata и в `plan-features.ts`. Переименование в Starter/Agency/Pro без миграции подписок сломает оплату. Новые имена — витрина поверх тех же или новых Price ID, не смена enum в первом же шаге.
4. Dashboard — командный центр одного пользователя. Agency home нельзя сделать второй копией статистики. Нужен тот же `buildDashboardStats`, с фильтром workspace.
5. AI-чат и Intelligence Score — рост и поддержка, не ядро агентства. Их не надо выкидывать и не надо ставить в центр нового позиционирования.
6. First-party SDK не должен входить в fetch pipeline как обход Cloudflare. Это отдельный приёмник событий с собственным токеном.

---

## Proposed Target Architecture

Один контур мониторинга. Сверху — слой агентства.

```
Workspace
  └── Client
        └── Monitor (существующая проверка, снимок, diff, AI, alert)
```

- Биллинг остаётся на подписке. На переходном этапе подписка остаётся у пользователя-владельца workspace. Квоты считаются по мониторам workspace, через те же `plan-guards`.
- Проверка страницы не ветвится. Official source → Scrapling, как сейчас.
- Неуспешный fetch по-прежнему не затирает snapshot.
- SDK и domain verification — отдельные входы, которые создают события или разрешают серверный fetch. Они не заменяют scheduler.
- Уведомления остаются в `deliver.ts`. Появляется адресат «по клиенту», но канал тот же.
- Отчёты остаются в `src/lib/reports`, выборка группируется по клиенту.

Mode 1 остаётся текущим fetch.  
Mode 2 — скрипт, который владелец сайта ставит сам. Он шлёт ошибки JS и сигналы о выбранных элементах. Не читает формы, пароли и платежи.  
Mode 3 — монитор помечается verified только после DNS, meta или HTML-файла на домене. Это не обход чужой защиты.

---

## Database Changes

Не делать в Phase 0. Когда будет разрешение на Phase 1, минимальная совместимая схема:

- `Workspace`: id, name, ownerUserId, createdAt.
- `WorkspaceMember`: workspaceId, userId, role.
- `Client`: id, workspaceId, name, notes, createdAt.
- `Monitor.workspaceId` и `Monitor.clientId` — nullable. Старые мониторы остаются на `userId` и продолжают проверяться.
- Уникальность URL: сначала сохранить `@@unique([userId, url])`. Позже добавить уникальность внутри workspace, не удаляя старый индекс, пока данные не перенесены.
- `AuditEvent` отдельно от `AnalyticsEvent`.

`Team` не удалять в первой миграции. Иначе сломаются инвайты, которые уже есть в схеме.

---

## API Changes

Позже, не сейчас:

- `/api/workspaces`, `/api/clients` с проверкой членства на сервере.
- Существующие `/api/monitors` принимают необязательный `clientId` и проверяют, что клиент в workspace пользователя.
- Список мониторов и dashboard stats фильтруются workspace, а не только `userId`.
- `/api/v1` остаётся, но ключ позже привязывается к workspace.
- Приём SDK: новый `/api/ingest/site` с отдельным токеном сайта, rate limit, без сессии Clerk.

Ни один id из браузера не является доказательством прав.

---

## Frontend Changes

Позже, не сейчас:

- После входа: создать workspace, клиента, затем монитор. Текущий диалог монитора остаётся шагом «добавить сайт».
- Главная показывает числа по сайтам и клиентам, последние критичные изменения и список клиентов. Текущий command center не выбрасывать: он становится видом «все сайты» внутри workspace.
- Мобильная вёрстка тех же списков, без отдельного приложения.
- Визуальный язык текущей тёмной панели сохранить.

---

## Implementation Phases

Оценки: S — дни, M — одна-две недели, L — больше двух недель. Сроки зависят от одного инженера и не включают ожидание ключей Stripe и магазинов.

| Фаза | Цель | Оценка | Зависит от |
| --- | --- | --- | --- |
| 0. Аудит | Этот документ | сделано | — |
| 1. Модель данных | Workspace, Client, nullable-связи, обратная совместимость мониторов | M | 0 |
| 2. Workspace | Имя, члены-заготовка, сводка владельца | M | 1 |
| 3. Клиенты | CRUD, фильтр сайтов, статистика клиента | M | 2 |
| 4. Сайты в мониторинге | Привязка монитора к клиенту, общий список проблем | M | 3 |
| 5. SDK | Лёгкий скрипт, токен, приём ошибок и сигналов элементов | L | 4 |
| 6. Доверенный fetch | Верификация домена и понятные статусы отказа. Без обхода защиты | M | 4 |
| 7. AI и алерты | Важность для агентства, группировка, меньше ложных тревог | M | 4 |
| 8. Отчёты | Weekly/monthly по клиентам, затем логотип | M | 3, 7 |
| 9. Тарифы | Лимиты сайтов и мест в текущих планах. Новые цены Stripe отдельно | M | 1 |
| 10. Изоляция | Проверка всех новых и старых путей на чужой workspace | M | 1–4, и повтор после 5 |
| 11. UI | Сводка, desktop и mobile | M | 2–4 |
| 12. Прод | Миграции в деплое, ритм проверок, живые алерты | M | 10 |

Phase 10 не стоит оставлять на конец. Проверка прав входит в каждую фазу с Phase 1. Отдельная фаза — повторный проход, а не первое появление авторизации.

Порядок 5 и 6 можно поменять местами. SDK не нужен, чтобы агентство завело клиентов. Верификация домена тоже не нужна для первого внешнего мониторинга. Поэтому коммерческий каркас — фазы 1–4 и кусок 11. SDK и белый ярлык позже.

Phase 9 не должна менять действующие Stripe Price до отдельного решения. Сначала лимиты в `plan-features.ts`.

---

## Dependencies Between Phases

- Без `workspaceId` нельзя честно фильтровать клиентов и отчёты.
- Без клиента нельзя группировать алерты и отчёты по клиенту.
- SDK без сайта-монитора некуда привязать токен.
- Белый ярлык без отчёта по портфелю будет ещё одним флагом на пользователе. Такой флаг уже есть.
- Смена тарифов без изоляции позволит обойти лимит через старый `/api/monitors`, если квота смотрит только на новую таблицу.

---

## Testing Strategy

Уже есть скрипты: sources, marketplace, scrapling, scheduler, plan rules, product access, coverage, universal, assets, live public, storefront. Их нужно гонять после каждой фазы, не отключать.

Для агентства добавить фикстуры без сети:

- пользователь A не читает workspace пользователя B;
- монитор без `clientId` по-прежнему проверяется scheduler;
- неуспешный fetch не пишет snapshot;
- квота мониторов считается по workspace и не обходится вторым запросом.

Живые открытия магазинов не считать критерием фазы. Критерий — честный статус и сохранённый последний снимок.

Типы: `tsc --noEmit`. Сборка: `npm run build`. Миграции на проде — только `migrate deploy` к той базе, где уже есть предыдущие миграции. Пустую базу этим репозиторием с нуля через `migrate deploy` поднимать нельзя: ранние миграции инкрементальные.

---

## Production Risks

- Деплой схемы без миграции роняет dashboard у вошедших пользователей.
- Поминутный cron на Hobby роняет весь деплой Vercel.
- Обещание «каждый магазин из каталога мониторится» неверно.
- Amazon, eBay и Etsy для платного сравнения не одобрены площадками.
- Email, Telegram и Stripe в проде зависят от секретов на Vercel. Наличие кода не доказывает доставку.
- SDK, если когда-нибудь будет подключён к чужим страницам без установки владельцем, станет нарушением границы из этого документа.

---

## Что сохранить без изменений

- Scheduler, `MonitorQueue` и правило «один URL в пакете».
- Порядок fetch: официальный источник, затем Scrapling. Без второго пайплайна.
- Запрет затирать последний успешный snapshot при ошибке и challenge.
- SSRF-проверку и отказ обходить CAPTCHA, логин и антибот.
- Clerk в проде и запрет локальной сессии в production.
- Проверку подписи Stripe webhook.
- Хеш API-ключа, а не сам ключ.
- Текущие мониторы, снимки и пользователей. Новые поля только nullable.
- Enum планов FREE/PRO/BUSINESS, пока отдельно не решены новые Stripe Price.
- AI fallback, категории изменений и сохранение сырого diff.
- Существующие уведомления email, Telegram, in-app и webhook.
- Каталог магазинов как распознавание домена, не как гарантия доступа.

---

## Безопасная последовательность

Сначала модель и права (Phase 1), затем экран агентства и клиенты (2–4), и только потом SDK, верификация домена, отчёты и косметика тарифов. Изоляция проверяется в каждой из этих фаз, а не один раз в конце.

Начинать с SDK, нового биллинга или переписывания fetch — вредно: нет места, куда класть токен, и легко сломать текущие подписки и проверки.

---

## PHASE 1 — IMPLEMENTATION RESULTS

Сделано 13 ноября 2026. Интерфейс агентства, scheduler, fetch, AI, Stripe и Team не менялись. Существующие мониторы не переназначались.

### Модели

- `Workspace`: `id`, `name`, `ownerId`, `settings` (пустой JSON на будущее), `createdAt`, `updatedAt`. Владелец — существующий `User`. Несколько workspace на одного владельца разрешены. Участники workspace пока не заведены: текущий `Team` остаётся отдельной схемой шаринга.
- `Client`: `id`, `workspaceId`, `name`, `createdAt`, `updatedAt`. Email, сайт и заметки не добавлялись. Один клиент принадлежит одному workspace. Смена `workspaceId` у клиента запрещена триггером.

### Поля Monitor

- `workspaceId` и `clientId` nullable.
- `userId` и `teamId` не изменялись.
- У существующего монитора `https://example.com` оба новых поля остались `NULL`.

### Миграция

`prisma/migrations/20261113160000_workspace_client/migration.sql`

Ограничения:

- `Workspace.ownerId` → `User` ON DELETE CASCADE. Удаление пользователя по-прежнему убирает его данные.
- `Client.workspaceId` → `Workspace` ON DELETE CASCADE. Клиенты живут только вместе с workspace.
- `Monitor.workspaceId` → `Workspace` ON DELETE SET NULL.
- `Monitor.clientId` → `Client` ON DELETE SET NULL.
- Перед удалением workspace мониторы отвязываются: оба поля становятся `NULL`, строка монитора и его история остаются.
- Триггер `monitor_tenant_guard`: если у монитора указан существующий клиент, `workspaceId` монитора обязан совпадать с workspace этого клиента.
- Ограничение `Monitor_client_requires_workspace`: `clientId` не может быть задан при пустом `workspaceId`.
- Повторный запуск этого SQL на локальной базе проходит: объекты создаются с `IF NOT EXISTS` и `duplicate_object`.
- Индексы: `Workspace_ownerId_idx`, `Client_workspaceId_idx`, `Client_id_workspaceId_key`, `Monitor_workspaceId_idx`, `Monitor_clientId_idx`.

Локальная база на `127.0.0.1:54329` получила эту схему. Полный `prisma migrate deploy` по всей истории не запускался: эта база собиралась через `db push`, а ранние миграции инкрементальные. SQL этой фазы выполнен отдельно и прошёл.

Продакшен этой миграцией не обновлялся. `vercel.json` по-прежнему собирает проект через `npm run build` без `migrate deploy`.

### Проверка в коде

`src/lib/tenancy.ts` повторяет правило связи для будущих API. Сейчас его не вызывает scheduler и не вызывают старые маршруты мониторов.

### Тесты

Прошли:

- `scripts/test-tenant-foundation.ts` — создание workspace и client, монитор без новых полей, отказ чужого client, сохранение монитора при удалении client и workspace, старый example-монитор не тронут.
- plan rules, scheduler guards, coverage guards, product access, dev session, sources (26/26), marketplace catalog, universal, assets, marketplace engine (22/22, живые Amazon/eBay пропущены без ключей).
- `tsc --noEmit`.
- `next lint` по затронутым файлам: без предупреждений.

Не запускались живые `test-scrapling-engine`, `test-live-public`, `test-storefront-quality` и `test-monitoring-engine`. Они ходят в сеть и не затрагивают эту схему. `test-monitoring-engine` ещё и сдвинул бы `lastCheckedAt` у существующего монитора.

### Решения

- `Team` не превращён в workspace.
- Старым пользователям workspace не создавались.
- Удаление workspace не каскадирует на мониторы.
- Целостность «клиент из другого workspace» держит триггер базы, а не секретность идентификатора.

### Что осталось для Phase 2

- API и экран workspace.
- Члены workspace, отдельно от текущего Team.
- Проверка прав на каждом новом маршруте: владелец или участник, без доверия к id из браузера.
- Привязка монитора к клиенту в интерфейсе.
- Применение миграции на продакшен-базе до деплоя кода, который читает новые таблицы.

Phase 2 закрыла членство и права. Phase 3 закрыла клиентов внутри workspace. Phase 4 связывает сайты с клиентом: новый монитор может получить `clientId`, уже существующий свой сайт можно прикрепить в настройках, а workspace показывает сбои проверок и важные изменения за 7 дней. Phase 5 добавляет скрипт, который владелец ставит на свой сайт. Phase 6 добавляет проверку домена через DNS TXT, файл `.well-known` или meta-тег. Успех записывает, что хост подтверждён, и не меняет загрузку страницы. Phase 7 складывает похожие тревоги одного клиента. Phase 8 добавляет отчёт по клиенту за неделю и месяц. Phase 9 ограничивает число агентств, мест и сайтов. Phase 10 повторно проверяет изоляцию. Phase 11 показывает сводку агентства на главной. Phase 12 не выкладывает код и не мигрирует боевую базу. Выкладка заблокирована, пока оператор вручную не применит пять миграций. `vercel.json` по-прежнему собирает проект без `migrate deploy`. Подробности в `PHASE_12_PRODUCTION_READINESS.md`.
