"""Static contract and documentation checks for proposed (non-DDX) interfaces."""
from __future__ import annotations

from pathlib import Path
import json
import re

import yaml
from jsonschema import Draft202012Validator, FormatChecker
from openapi_spec_validator import validate_spec

repository = Path(__file__).resolve().parents[3]
sa = repository / "first-set" / "sa"
openapi = yaml.safe_load((sa / "contracts/openapi.yaml").read_text(encoding="utf-8"))
event_schema = json.loads((sa / "contracts/events.schema.json").read_text(encoding="utf-8"))

validate_spec(openapi)
Draft202012Validator.check_schema(event_schema)
stages = ["DUMBBELLS", "BARBELL", "BENCH", "INVENTORY"]
assert openapi["components"]["schemas"]["Stage"]["enum"] == stages
assert event_schema["properties"]["stage"]["enum"] == stages
assert len(openapi["components"]["schemas"]["AnswerRequest"]["properties"]["action"]["oneOf"]) == 4
scenario = json.loads((sa / "contracts/scenario-v1.sample.json").read_text(encoding="utf-8"))
assert scenario["version"] == "1.0"
assert [stage["stage"] for stage in scenario["stages"]] == stages
assert [stage["interactionKind"] for stage in scenario["stages"]] == [
    "PAIR_TO_SLOT", "DISK_TO_SIDE", "ORDERED_CHECKS", "ITEM_TO_ZONE"
]
assert [len(stage["items"]) for stage in scenario["stages"]] == [3, 4, 6, 8]
for stage in scenario["stages"]:
    ids = [item["id"] for item in stage["items"]]
    assert len(ids) == len(set(ids)), f"duplicate item IDs in {stage['stage']}"

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
validator = Draft202012Validator(event_schema, format_checker=FormatChecker())
assert not list(validator.iter_errors(sample))
assert list(validator.iter_errors({key: value for key, value in sample.items() if key != "stage"}))
assert list(validator.iter_errors({**sample, "memberName": "DO NOT PUBLISH"}))

for name in [
    "01-context.md", "02-requirements.md", "03-state-machine.md",
    "04-data-model.md", "05-events.md", "06-acceptance.md", "07-open-questions.md"
]:
    assert (sa / "docs" / name).is_file(), name

broken_links = []
for markdown in repository.rglob("*.md"):
    if ".git" in markdown.parts:
        continue
    body = markdown.read_text(encoding="utf-8")
    for destination in re.findall(r"\]\(([^)]+)\)", body):
        if destination.startswith(("http://", "https://", "mailto:", "#")):
            continue
        target = destination.split("#", 1)[0].split("?", 1)[0]
        if target and not (markdown.parent / target).exists():
            broken_links.append(f"{markdown.relative_to(repository)} → {destination}")
assert not broken_links, "\n".join(broken_links)

print("OK: valid OpenAPI / event schema, station parity, local Markdown links")
