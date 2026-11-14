# Phase 2 — матрица авторизации API

Проверено чтением маршрутов и прогоном `scripts/test-workspace-auth.ts` на локальной базе. Старые маршруты мониторов и Team не менялись: они по-прежнему смотрят на `userId` и членство Team, не на Workspace.

Ответ при отказе в новых маршрутах один: `404 Not found`. Так нельзя отличить чужой объект от отсутствующего.

| Операция | Маршрут | Сущность | Кто может | Где проверка | Тест |
| --- | --- | --- | --- | --- | --- |
| Список своих | GET `/api/workspaces` | Workspace | только свои membership или ownerId | `listWorkspaces` фильтрует по пользователю | stranger не видит чужой id |
| Создать | POST `/api/workspaces` | Workspace | любой вошедший пользователь, становится OWNER | `createWorkspace` пишет ownerId текущего пользователя и membership в одной транзакции | owner membership OWNER |
| Прочитать | GET `/api/workspaces/:id` | Workspace | workspace.read: любая роль | `readWorkspace` → `requireWorkspacePermission` | stranger и неизвестный id → 404 |
| Переименовать | PATCH `/api/workspaces/:id` | Workspace | workspace.update: OWNER, ADMIN. Тело строго `{ name }` | `renameWorkspace`. `ownerId` в тело не входит, `.strict()` отклоняет лишние поля | viewer 404, admin меняет имя |
| Удалить | DELETE `/api/workspaces/:id` | Workspace | workspace.delete: только OWNER | `deleteWorkspace` | member и admin получают 404 |
| Список участников | GET `/api/workspaces/:id/members` | WorkspaceMember | members.read: любая роль | `listMembers` после той же проверки | косвенно: без доступа read workspace уже 404 |
| Сменить роль | PATCH `.../members/:userId` | WorkspaceMember | members.update. OWNER не выдаётся и не снимается | `setMemberRole` и триггер базы | self-OWNER 404, admin не меняет owner, база отвергает второго OWNER |
| Снять участника | DELETE `.../members/:userId` | WorkspaceMember | members.remove. OWNER не снимается. ADMIN снимает только MEMBER и VIEWER | `removeMember` и триггер `workspace_member_delete_guard` | admin не снимает другого admin; owner снимает admin, после этого 404 |
| Выпустить код | POST `.../invites` | WorkspaceInvite | members.invite. Роль только ADMIN, MEMBER, VIEWER. ADMIN не приглашает ADMIN | `createWorkspaceInvite` и CHECK `role <> OWNER` | код принимается один раз |
| Принять код | POST `/api/workspaces/join` | WorkspaceMember | вошедший пользователь принимает код сам | `redeemWorkspaceInvite`. Код хранится как SHA-256 | повтор другим пользователем → 404 |
| Чтение клиента | нет публичного CRUD | Client | clients.read через `assertClientVisible` | сначала клиент, затем permission на его workspaceId | owner видит, снятый участник — 404 |
| Чтение монитора workspace | нет нового CRUD | Monitor | monitors.read через `assertMonitorVisibleInWorkspace` | только если у монитора есть workspaceId | outsider и снятый участник — 404 |
| Старые мониторы | `/api/monitors` и вложенные | Monitor | прежний `userId` и Team | `assertMonitorOwnedBy`, `monitorReadFilter` | userId-проверка находит монитор после привязки; чужой workspace её не расширяет |
| Team | `/api/teams` | Team | прежний план TEAM_MEMBERS | не использует Workspace | код Team не менялся в этой фазе |

Scheduler, cron, Stripe webhook, Telegram webhook и Clerk middleware не получили новых правил и не ходят в Workspace.
