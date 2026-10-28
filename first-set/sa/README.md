# Системный анализ · «Первый подход»

[← Обзор кейса](../../README.md) · [Карта артефактов](../../NAVIGATION.md) · [Перейти в BA](../ba/README.md) · **SA** · [Демо](../demo/README.md)

**Что проектируем:** вариант системной реализации четырёх интерактивных станций в DDX Fitness App: сессия, ревизии, типизированные действия, версионированный контент, события и интеграционная граница с уже существующей записью. Реальные API и внутренний стек компании неизвестны.

## Читать SA по порядку

| № | Документ | Что в нём определено | Связь с BA |
|---|---|---|---|
| 01 | [System Context](docs/01-context.md) | Границы приложения, игры, существующей записи и аналитики | [Product Brief](../ba/docs/01-product-brief.md) |
| 02 | [Requirements](docs/02-requirements.md) | Трассировка BA → SA → AC; инварианты | [Business Requirements](../ba/docs/02-business-requirements.md) |
| 03 | [State Machine](docs/03-state-machine.md) | Status vs stage/progress; переходы и повторы | [Product Decisions](../ba/docs/05-decisions.md) |
| 04 | [Data Model](docs/04-data-model.md) | Сессии, версии сценариев, идемпотентность, outbox | [Business Rules](../ba/docs/02-business-requirements.md) |
| 05 | [Events](docs/05-events.md) | Источники истины и атрибуция | [Validation Plan](../ba/docs/03-validation-plan.md) |
| 06 | [Acceptance](docs/06-acceptance.md) | 26 проверяемых позитивных и негативных сценариев | [Solution Requirements](../ba/docs/02-business-requirements.md) |
| 07 | [Open Questions](docs/07-open-questions.md) | Что нужно выяснить у команды DDX | [Evidence Register](../ba/docs/04-evidence-register.md) |

**Контракты:** [OpenAPI](contracts/openapi.yaml) · [Пример манифеста игрового сценария](contracts/scenario-v1.sample.json) · [JSON Schema событий](contracts/events.schema.json).

## Общая связка BA ↔ SA

| Участок | Бизнес-анализ (BA) | Системный анализ (SA) |
|---|---|---|
| **Контекст и доказательства** | [Product Brief](../ba/docs/01-product-brief.md) · [Evidence](../ba/docs/04-evidence-register.md) | [System Context](../sa/docs/01-context.md) · [Open Questions](../sa/docs/07-open-questions.md) |
| **Требования и проверка** | [Requirements](../ba/docs/02-business-requirements.md) | [System Requirements](../sa/docs/02-requirements.md) · [Acceptance](../sa/docs/06-acceptance.md) |
| **Сценарии и архитектура** | [Product Decisions](../ba/docs/05-decisions.md) | [States](../sa/docs/03-state-machine.md) · [Data](../sa/docs/04-data-model.md) · [API](../sa/contracts/openapi.yaml) |
| **Результат и измерение** | [Validation Plan](../ba/docs/03-validation-plan.md) | [Events](../sa/docs/05-events.md) · [Event Schema](../sa/contracts/events.schema.json) |

**Что реализовано:** [браузерный прототип](../demo/README.md) с локальным состоянием; idempotency, авторизация и серверная согласованность здесь только специфицированы. См. [границы демо](../demo/README.md#что-не-реализовано).

[← Бизнес-анализ](../ba/README.md) · [Полная карта артефактов](../../NAVIGATION.md) · [Демо →](../demo/README.md)
