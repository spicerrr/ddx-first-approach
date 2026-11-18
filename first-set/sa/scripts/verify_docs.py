"""Проверки сценария 2.0, схемы аналитики, ссылок и прослеживаемости."""

from collections import Counter
import json
from pathlib import Path
import re

from jsonschema import Draft202012Validator, FormatChecker

SA = Path(__file__).resolve().parents[1]
REPO = SA.parents[1]
DOCS = [
    REPO / "README.md",
    REPO / "first-set/ba/README.md",
    SA / "README.md",
    REPO / "first-set/demo/README.md",
]


def contract(name):
    return json.loads((SA / "contracts" / name).read_text(encoding="utf-8"))


scenario = contract("scenario-v2.sample.json")
dumbbells, barbell, bench, inventory = scenario["stages"]
stage_ids = [stage["stage"] for stage in scenario["stages"]]
assert stage_ids == ["DUMBBELLS", "BARBELL", "BENCH", "INVENTORY"]
for station in scenario["stages"]:
    ids = [item["id"] for item in station.get("items", [])]
    assert len(ids) == len(set(ids)), station["stage"]

slots = {slot["targetId"]: slot["weightKg"] for row in dumbbells["rackRows"] for slot in row if "targetId" in slot}
assert Counter(slots[item["targetId"]] for item in dumbbells["items"]) == {8: 2, 12: 2, 16: 2}
assert Counter(item["weightKg"] for item in barbell["items"] if item["kind"] == "disk") == {5: 4, 10: 2, 20: 2}
assert barbell["sides"] == ["LEFT", "RIGHT"]
assert barbell["shaftKg"] == 20
assert barbell["completion"] == {"targetKg": 80, "sideDifferenceKg": 0, "closedCollars": 2}
assert sum(item["kind"] == "collar" for item in barbell["items"]) == barbell["completion"]["closedCollars"]
assert [(part["id"], part["targetNotch"]) for part in bench["parts"]] == [("backrest", 2), ("seat", 1)]
assert all(part["targetNotch"] in bench["notches"] for part in bench["parts"])

plates = [item for item in inventory["items"] if "weightKg" in item]
supplies = [item for item in inventory["items"] if "weightKg" not in item]
assert sorted(item["weightKg"] for item in plates) == [5, 10, 15, 20, 25]
assert len({item["targetId"] for item in plates}) == len(plates)
assert Counter(item["targetId"] for item in supplies) == {zone["id"]: 2 for zone in inventory["shelvesAndHooks"]}
assert set(item["targetId"] for item in plates).isdisjoint(item["targetId"] for item in supplies)
assert len(inventory["items"]) == 13
assert inventory["initialLayout"] == {
    "platesPreplaced": 2,
    "distinctStorageZonesPreplaced": 3,
    "minLoosePerStorageZone": 1,
}

events = contract("events.schema.json")
Draft202012Validator.check_schema(events)
assert events["$defs"]["stage"]["enum"] == stage_ids
validator = Draft202012Validator(events, format_checker=FormatChecker())
event_base = {"schemaVersion": "2", "scenarioVersion": scenario["version"], "occurredAt": "2026-11-18T08:00:00Z"}
examples = {
    "first_approach_exposed": {},
    "first_approach_started": {},
    "first_approach_stage_started": {"stage": "DUMBBELLS"},
    "first_approach_stage_completed": {"stage": "INVENTORY"},
    "first_approach_hint_requested": {"stage": "INVENTORY", "concept": "inventory-MATS"},
    "first_approach_hint_level_reached": {"stage": "INVENTORY", "concept": "inventory-MATS", "hintLevel": 3},
    "first_approach_demo_opened": {"stage": "BENCH", "concept": "bench-backrest-locked"},
    "first_approach_completed": {},
    "first_approach_skipped": {},
    "training_cta_clicked": {"source": "finish", "training": "intro"},
}
for name, fields in examples.items():
    example = {**event_base, "eventType": name, **fields}
    validator.validate(example)
    assert not validator.is_valid({**example, "memberName": "example"})
    for field in fields:
        assert not validator.is_valid({k: v for k, v in example.items() if k != field})

documents = {file: file.read_text(encoding="utf-8") for file in DOCS}
for file, body in documents.items():
    for dest in re.findall(r"\]\(([^)]+)\)", body):
        if dest.startswith(("https://", "http://", "mailto:", "#")):
            continue
        path = dest.split("#", 1)[0].split("?", 1)[0]
        assert not path or (file.parent / path).exists(), f"{file.relative_to(REPO)} → {dest}"

ba = documents[DOCS[1]]
sa = documents[DOCS[2]]
ba_requirements = set(re.findall(r"^\| ((?:FR|NFR)-\d\d) \|", ba, re.M))
assert ba_requirements == set(re.findall(r"\b(?:FR|NFR)-\d\d\b", sa))
assert all(name in sa for name in examples)
assert all(f"AC-{index:02d}" in sa for index in range(1, 8))
print("OK: сценарий 2.0, десять аналитических событий, ссылки и трассируемость")
