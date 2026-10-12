# 04 · Conceptual data model

```mermaid
erDiagram
  MEMBER ||--o{ GAME_SESSION : owns
  SCENARIO ||--o{ GAME_SESSION : snapshotted
  GAME_SESSION ||--o{ ANSWER_ATTEMPT : contains
  GAME_SESSION ||--o{ IDEMPOTENCY_RESULT : protects
  GAME_SESSION ||--o{ OUTBOX_EVENT : emits
  MEMBER { string memberId PK }
  SCENARIO { string id PK string version }
  GAME_SESSION { uuid id PK string memberId string status string stage int revision string scenarioVersion }
  ANSWER_ATTEMPT { uuid id PK uuid sessionId string requestId boolean accepted }
  IDEMPOTENCY_RESULT { string requestId PK uuid sessionId json result }
  OUTBOX_EVENT { uuid eventId PK uuid sessionId string eventType }
```

Уникальность (sessionId,requestId), только одна ACTIVE-сессия на memberId, CHECK допустимых этапов/статусов, атомарная запись перехода и outbox. Никакого дублирования профиля, оплат, медицинских данных или бронирований. Outbox — предлагаемый вариант, не подтверждённый стек DDX.
