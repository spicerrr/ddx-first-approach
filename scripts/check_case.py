#!/usr/bin/env python3
"""Небольшая проверка согласованности артефактов портфельного SA-кейса."""
from __future__ import annotations

import json
import re
from decimal import Decimal
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
docs = {p.name: p.read_text(encoding="utf-8") for p in (ROOT / "docs").glob("*.md")}
readme = (ROOT / "README.md").read_text(encoding="utf-8")
api = yaml.safe_load((ROOT / "contracts/openapi.yaml").read_text(encoding="utf-8"))
async_api = yaml.safe_load((ROOT / "contracts/asyncapi.yaml").read_text(encoding="utf-8"))
scenario = json.loads((ROOT / "fixtures/scenario-v2.json").read_text(encoding="utf-8"))
event_schema = json.loads((ROOT / "contracts/events.schema.json").read_text(encoding="utf-8"))


def check(condition: bool, message: str) -> None:
    if not condition:
        raise AssertionError(message)


def refs(node, document, path="root"):
    if isinstance(node, dict):
        for key, value in node.items():
            if key == "$ref":
                check(value.startswith("#/"), f"external ref: {value}")
                target = document
                for part in value[2:].split("/"):
                    check(part in target, f"broken ref at {path}: {value}")
                    target = target[part]
            else:
                refs(value, document, f"{path}/{key}")
    elif isinstance(node, list):
        for index, value in enumerate(node):
            refs(value, document, f"{path}[{index}]")


check(api["openapi"].startswith("3.0."), "OpenAPI version")
refs(api, api)
refs(async_api, async_api)
methods = {(path, method) for path, item in api["paths"].items() for method in item if method in {"get", "post"}}
check(len(methods) == 8, f"expected eight endpoints, got {len(methods)}")
for path, method in methods:
    operation = api["paths"][path][method]
    check("operationId" in operation, f"missing operationId {method} {path}")
    check("responses" in operation, f"missing responses {method} {path}")
    check("426" in operation["responses"], f"missing upgrade response {method} {path}")
for path, item in api["paths"].items():
    check({"$ref": "#/components/parameters/ClientSchemaVersion"} in item["parameters"],
          f"missing client schema header {path}")
check("scenarioSchemaVersion" in api["components"]["schemas"]["Session"]["required"], "session schema version")

required_states = {"ACTIVE", "PAUSED_HELP", "COMPLETED", "ABANDONED", "EXPIRED"}
required_stages = {"DUMBBELLS", "BARBELL", "HELP", "EQUIPMENT", "RESULT", "NONE"}
schemas = api["components"]["schemas"]
check(set(schemas["Status"]["enum"]) == required_states, "status enum mismatch")
check(set(schemas["StageName"]["enum"]) == required_stages, "stage enum mismatch")
state_text = docs["03-state-machine.md"]
for pair in ["ACTIVE/DUMBBELLS", "ACTIVE/BARBELL", "PAUSED_HELP/HELP", "ACTIVE/EQUIPMENT",
             "COMPLETED/RESULT", "ABANDONED/NONE", "EXPIRED/NONE"]:
    check(pair in state_text, f"missing state pair {pair}")

requirements = set(re.findall(r"REQ-\d{2}", docs["02-requirements.md"]))
acceptance = set(re.findall(r"AC-\d{2}", docs["07-acceptance.md"]))
check(requirements == {f"REQ-{i:02d}" for i in range(1, 20)}, "requirements missing")
check(acceptance == {f"AC-{i:02d}" for i in range(1, 31)}, "acceptance missing")
trace = docs["02-requirements.md"].split("## Трассировка", 1)[1]
for req in requirements:
    check(req in trace, f"untraced {req}")
for ac in acceptance:
    check(ac in trace, f"untraced {ac}")

def ids(items):
    return [item["id"] for item in items]

for key in ("dumbbells", "barbell", "equipment"):
    items = scenario[key]["availablePlates" if key == "barbell" else "items"]
    check(len(ids(items)) == len(set(ids(items))), f"duplicate ID in {key}")
check(len(scenario["dumbbells"]["items"]) == 6, "six dumbbells required")
check(len(scenario["equipment"]["items"]) == 8, "eight equipment items required")
for zone in scenario["equipment"]["zones"]:
    check(sum(item["type"] == zone for item in scenario["equipment"]["items"]) == 2,
          f"two items required in {zone}")

bar = scenario["barbell"]
weights = {item["id"]: Decimal(str(item["weightKg"])) for item in bar["availablePlates"]}
left = [weights[item] for item in ("L_2_5", "L_1_25")]
right = [weights[item] for item in ("R_2_5", "R_1_25")]
check(sum(left) == sum(right), "barbell should be symmetric")
actual = Decimal(str(bar["barKg"])) + 2 * sum(map(lambda x: Decimal(str(x)), bar["preloadedEachSideKg"])) + sum(left + right)
check(actual == Decimal(str(bar["targetKg"])) == Decimal("77.5"), f"barbell sum {actual}")
help_event = scenario["helpEvent"]
step_ids = [step["id"] for step in help_event["steps"]]
check(step_ids == ["BACK_PIN", "BACK_ADJUST", "BACK_LOCK", "SEAT_LEVER", "SEAT_ADJUST", "SEAT_LOCK"], "help step order")
check(help_event["type"] == "ADJUST_BENCH" and help_event["guideId"] and help_event["equipmentCatalogRef"], "guide reference")
check(scenario["scenarioSchemaVersion"] == 2, "fixture schema version")
check(schemas["HelpProgress"]["properties"]["nextStepIndex"]["maximum"] == len(step_ids)-1, "help index")
check(schemas["HelpRequest"]["allOf"][1]["required"] == ["stepId", "targetId"], "help action fields")
check("/v1/equipment-guides/{guideId}" in api["paths"], "guide endpoint")
check(event_schema["properties"]["source"]["const"] == "shift", "event source")
server_events = set(event_schema["properties"]["eventName"]["enum"])
for event in server_events:
    check(f"`{event}`" in docs["05-events.md"] or event in docs["05-events.md"],
          f"undocumented event: {event}")
check(len(server_events) == 9, "server event list")
check(async_api["asyncapi"] == "3.0.0", "AsyncAPI version")
channel = async_api["channels"]["shiftSessionEvents"]
check(channel["address"] == "shift.session.events.v1", "topic address")
check(channel["bindings"]["kafka"]["topic"] == channel["address"], "Kafka binding topic")
check(async_api["operations"]["publishShiftSessionEvent"]["action"] == "send", "publisher action")
async_message = async_api["components"]["messages"]["ShiftSessionEvent"]
check(set(async_message["payload"]["properties"]["eventName"]["enum"]) == server_events,
      "AsyncAPI and event schema enum mismatch")
check(set(async_message["payload"]["required"]) == set(event_schema["required"]),
      "AsyncAPI and JSON schema fields mismatch")
check({"stateVersion", "eventSequence"}.issubset(event_schema["required"]), "event ordering fields")
check(all(name in readme for name in ["10-mobile.md", "11-messaging.md", "12-ddx-integration.md", "13-bench-guide.md"]), "new docs linked")

for link in re.findall(r"\]\(([^)]+)\)", readme):
    if not link.startswith("https://"):
        check((ROOT / link).exists(), f"broken README link: {link}")
for filename, content in docs.items():
    for link in re.findall(r"\]\(([^)]+)\)", content):
        if not link.startswith("https://"):
            check((ROOT / "docs" / link).exists(),
                  f"broken docs link in {filename}: {link}")
print("OK: OpenAPI, AsyncAPI, states, traceability, fixtures, README links")
