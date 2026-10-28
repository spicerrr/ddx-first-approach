# Бизнес-анализ · «Первый подход»

[← Обзор кейса](../../README.md) · [Карта артефактов](../../NAVIGATION.md) · **BA** · [Перейти в SA](../sa/README.md) · [Демо](../demo/README.md)

**Что решаем:** проверяем гипотезу о том, что части новых участников DDX не хватает понятного маршрута к существующим форматам адаптации. Наличие проблемы, её масштаб и добавленная ценность игры над простой карточкой **не доказаны**. Исходная бизнес-задача не должна считаться фактом только потому, что для неё предложено решение.

## Читать BA по порядку

| № | Документ | Что в нём выясняется | Переход к SA |
|---|---|---|---|
| 01 | [Product Brief](docs/01-product-brief.md) | Сегмент, проблема/гипотеза, альтернативы, MVP | [System Context](../sa/docs/01-context.md) |
| 02 | [Requirements](docs/02-business-requirements.md) | Бизнес-результаты → потребности → функции → ограничения | [System Requirements](../sa/docs/02-requirements.md) |
| 03 | [Validation Plan](docs/03-validation-plan.md) | Проверка проблемы, A/B/C, метрики, условия отказа | [Events](../sa/docs/05-events.md) |
| 04 | [Evidence Register](docs/04-evidence-register.md) | Публичные факты, допущения, недостающие данные | [Open Questions](../sa/docs/07-open-questions.md) |
| 05 | [Product Decisions](docs/05-decisions.md) | Границы продукта и невыбранные механики | [State Machine](../sa/docs/03-state-machine.md) · [Data Model](../sa/docs/04-data-model.md) |

## Общая связка BA ↔ SA

| Участок | Бизнес-анализ (BA) | Системный анализ (SA) |
|---|---|---|
| **Контекст и доказательства** | [Product Brief](../ba/docs/01-product-brief.md) · [Evidence](../ba/docs/04-evidence-register.md) | [System Context](../sa/docs/01-context.md) · [Open Questions](../sa/docs/07-open-questions.md) |
| **Требования и проверка** | [Requirements](../ba/docs/02-business-requirements.md) | [System Requirements](../sa/docs/02-requirements.md) · [Acceptance](../sa/docs/06-acceptance.md) |
| **Сценарии и архитектура** | [Product Decisions](../ba/docs/05-decisions.md) | [States](../sa/docs/03-state-machine.md) · [Data](../sa/docs/04-data-model.md) · [API](../sa/contracts/openapi.yaml) |
| **Результат и измерение** | [Validation Plan](../ba/docs/03-validation-plan.md) | [Events](../sa/docs/05-events.md) · [Event Schema](../sa/contracts/events.schema.json) |

**Маршрут к демонстрации:** [сценарий MVP](docs/01-product-brief.md) → [системные требования](../sa/docs/02-requirements.md) → [демо](../demo/README.md). Объём серверной спецификации шире локально реализованного прототипа.

[← Главная](../../README.md) · [Полная карта артефактов](../../NAVIGATION.md) · [Системный анализ →](../sa/README.md)
