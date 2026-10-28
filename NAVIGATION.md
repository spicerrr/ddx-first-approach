# Карта проекта «Первый подход»

[← Обзор кейса](README.md) · [Бизнес-анализ](first-set/ba/README.md) · [Системный анализ](first-set/sa/README.md) · [Интерактивное демо](first-set/demo/README.md)

Эта страница связывает **одну** продуктовую гипотезу с аналитическими документами, системной спецификацией, контрактами и демонстрацией. BA и SA — не два самостоятельных проекта: между соответствующими документами проложены двусторонние переходы.

## Маршрут по задаче

| Шаг | Вопрос | BA: основание и решение | SA: поведение системы |
|---|---|---|---|
| **01. Контекст** | Для кого и зачем? Что подтверждено? | [Product Brief](first-set/ba/docs/01-product-brief.md) · [Evidence Register](first-set/ba/docs/04-evidence-register.md) | [System Context](first-set/sa/docs/01-context.md) · [Open Questions](first-set/sa/docs/07-open-questions.md) |
| **02. Требования** | Какой результат и какие правила? | [Business / Stakeholder / Solution Requirements](first-set/ba/docs/02-business-requirements.md) | [System Requirements](first-set/sa/docs/02-requirements.md) · [Acceptance Criteria](first-set/sa/docs/06-acceptance.md) |
| **03. Поведение** | Что происходит в игровых сценариях? | [Product Decisions](first-set/ba/docs/05-decisions.md) | [State Machine](first-set/sa/docs/03-state-machine.md) · [Data Model](first-set/sa/docs/04-data-model.md) |
| **04. Измерение** | Как отличить эффект игры от простого информирования? | [Validation Plan](first-set/ba/docs/03-validation-plan.md) | [Product Events](first-set/sa/docs/05-events.md) · [JSON Schema](first-set/sa/contracts/events.schema.json) |
| **05. Реализация и проверка** | Как взаимодействуют интерфейс, API и состояния? | [MVP / Alternatives](first-set/ba/docs/01-product-brief.md) · [План эксперимента](first-set/ba/docs/03-validation-plan.md) | [OpenAPI](first-set/sa/contracts/openapi.yaml) · [Scenario Manifest](first-set/sa/contracts/scenario-v1.sample.json) · [Приёмка](first-set/sa/docs/06-acceptance.md) · [Демо](first-set/demo/README.md) |

## Если хочешь быстро оценить кейс

1. **Продуктовая аргументация:** [постановка](first-set/ba/docs/01-product-brief.md) → [что действительно известно](first-set/ba/docs/04-evidence-register.md) → [как проверить гипотезу](first-set/ba/docs/03-validation-plan.md).
2. **Системный анализ:** [системные требования](first-set/sa/docs/02-requirements.md) → [состояния](first-set/sa/docs/03-state-machine.md) → [контракт API](first-set/sa/contracts/openapi.yaml) → [сценарии приёмки](first-set/sa/docs/06-acceptance.md).
3. **Посмотреть поведение:** [запуск браузерного прототипа](first-set/demo/README.md) → [его логика](first-set/demo/logic.js) → [контракт игрового сценария](first-set/sa/contracts/scenario-v1.sample.json).

## Границы доказательств

- **BA** описывает цель, стейкхолдеров, альтернативы, продуктовые гипотезы и критерии решения об инвестиции; отсутствие внутренних данных DDX прямо обозначено.
- **SA** проектирует возможную реализацию: поведение сессии, переходы, данные, контракты, события и ошибки. Это не утверждение о текущей архитектуре DDX.
- **Демо** воспроизводит интерактивные станции на локальном состоянии. Оно не вызывает API, не создаёт запись и не проверяет сетевую идемпотентность.

[К обзорной странице](README.md) · [Список выявленных ограничений](AUDIT.md)
