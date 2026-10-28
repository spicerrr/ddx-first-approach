"""Проверка контрактов и целостности аналитических документов проекта."""
from __future__ import annotations

from pathlib import Path
import json
import re

import yaml
from jsonschema import Draft202012Validator, FormatChecker
from openapi_spec_validator import validate_spec

repo = Path(__file__).resolve().parents[3]
sa = repo / "first-set" / "sa"
api = yaml.safe_load((sa / "contracts/openapi.yaml").read_text(encoding="utf-8"))
events = json.loads((sa / "contracts/events.schema.json").read_text(encoding="utf-8"))
scenario = json.loads((sa / "contracts/scenario-v1.sample.json").read_text(encoding="utf-8"))

validate_spec(api)
Draft202012Validator.check_schema(events)
stages = ["DUMBBELLS", "BARBELL", "BENCH", "INVENTORY"]
assert api["components"]["schemas"]["Stage"]["enum"] == stages
assert events["properties"]["stage"]["enum"] == stages
assert len(api["components"]["schemas"]["AnswerRequest"]["properties"]["action"]["oneOf"]) == 4
assert [stage["stage"] for stage in scenario["stages"]] == stages
assert [stage["interactionKind"] for stage in scenario["stages"]] == [
    "PAIR_TO_SLOT", "DISK_TO_SIDE", "ORDERED_CHECKS", "ITEM_TO_ZONE"
]
assert [len(stage["items"]) for stage in scenario["stages"]] == [3, 4, 6, 8]
for stage in scenario["stages"]:
    ids = [item["id"] for item in stage["items"]]
    assert len(ids) == len(set(ids)), f"duplicate IDs in {stage['stage']}"

sample = {
    "schemaVersion": "1",
    "eventId": "11111111-1111-4111-8111-111111111111",
    "eventType": "game_stage_completed",
    "occurredAt": "2026-10-28T12:00:00Z",
    "sessionId": "22222222-2222-4222-8222-222222222222",
    "scenarioVersion": "1.0",
    "revision": 2,
    "stage": "DUMBBELLS",
}
validator = Draft202012Validator(events, format_checker=FormatChecker())
assert not list(validator.iter_errors(sample))
assert list(validator.iter_errors({k: v for k, v in sample.items() if k != "stage"}))
assert list(validator.iter_errors({**sample, "memberName": "DO NOT PUBLISH"}))

# Четыре основных документа; подробности реализации остаются в коде и контрактах.
markdown_files = sorted(p.relative_to(repo).as_posix() for p in repo.rglob("*.md") if ".git" not in p.parts)
expected = sorted(["README.md", "first-set/ba/README.md", "first-set/sa/README.md", "first-set/demo/README.md"])
assert markdown_files == expected, f"unexpected Markdown document tree: {markdown_files}"

for path in [repo / p for p in expected]:
    body = path.read_text(encoding="utf-8")
    for dest in re.findall(r"\]\(([^)]+)\)", body):
        if dest.startswith(("https://", "http://", "mailto:", "#")):
            continue
        dest_path = dest.split("#", 1)[0].split("?", 1)[0]
        if dest_path and not (path.parent / dest_path).exists():
            raise AssertionError(f"Broken link: {path.relative_to(repo)} → {dest}")

# Проверяем структуру аналитических документов и полноту формальных реестров.
ba_text = (repo / "first-set/ba/README.md").read_text(encoding="utf-8")
sa_text = (repo / "first-set/sa/README.md").read_text(encoding="utf-8")
# Требования располагаются в самостоятельных разделах, а не в общей сводной таблице.
ba_sections = [
    "## 3. Заинтересованные стороны и потребности",
    "## 4. Цели и показатели результата",
    "## 5. Функциональные требования",
    "## 6. Бизнес-правила",
    "## 7. Нефункциональные требования",
    "## 8. Ограничения и интеграционные зависимости",
    "## 9. Зафиксированные продуктовые решения",
    "## 11. Реестр фактов и гипотез",
    "## 12. Прослеживаемость требований",
]
sa_sections = [
    "## 3. Системные требования и их прослеживаемость",
    "## 4. Жизненный цикл сессии",
    "## 5. Логическая модель данных",
    "## 7. События и их источники",
    "## 8. Критерии приёмки",
    "## 9. Открытые вопросы",
]
for section in ba_sections:
    assert section in ba_text, f"BA: missing section {section}"
for section in sa_sections:
    assert section in sa_text, f"SA: missing section {section}"

# Структура ключевых таблиц и идентификаторов проверяется независимо от языка полей API.
for title in ["| ID | Заинтересованная сторона | Потребность |",
              "| ID | Цель | Критерий оценки | Статус |",
              "| ID | Требование | Основание |",
              "| ID | Правило | Следствие для функции |",
              "| ID | Ограничение | Следствие |"]:
    assert title in ba_text, f"BA: missing table {title}"
for title in ["| ID | Основание (BA) | Системное требование | Критерии приёмки |",
              "| Действие | Предусловие | Результат |",
              "| ID | Условие / действие | Ожидаемый результат |"]:
    assert title in sa_text, f"SA: missing table {title}"

def check_ids(body: str, prefix: str, count: int) -> None:
    expected = {f"{prefix}-{number:02d}" for number in range(1, count + 1)}
    observed = set(re.findall(rf"\b{prefix}-\d{{2}}\b", body))
    assert observed == expected, f"{prefix}: missing {sorted(expected-observed)}, unknown {sorted(observed-expected)}"

for prefix, count in {"BG":3,"SN":5,"FR":11,"RL":6,"NFR":4,"IC":3,"EV":10,"PD":8}.items():
    check_ids(ba_text, prefix, count)
for prefix, count in {"SA":8,"AC":26,"OQ":12}.items():
    check_ids(sa_text, prefix, count)
for id in (f"AC-{i:02d}" for i in range(1, 27)):
    assert re.search(rf"^\| {re.escape(id)} \|", sa_text, re.MULTILINE), f"{id}: no acceptance row"
for id in (f"SA-{i:02d}" for i in range(1, 9)):
    assert re.search(rf"^\| {re.escape(id)} \|", sa_text, re.MULTILINE), f"{id}: no traceability row"

assert "Smart Start" in (repo / "README.md").read_text(encoding="utf-8")
assert "accepted" in (sa / "README.md").read_text(encoding="utf-8")
print("OK: контракты, ссылки, разделы BA/SA, все требования и 26 критериев приёмки")
