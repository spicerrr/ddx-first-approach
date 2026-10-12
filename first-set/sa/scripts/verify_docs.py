from pathlib import Path
import json
root=Path(__file__).resolve().parents[1]
schema=json.loads((root/'contracts/events.schema.json').read_text(encoding='utf-8'))
assert 'game_session_completed' in schema['properties']['eventType']['enum']
assert (root/'contracts/openapi.yaml').exists()
for name in ['01-context.md','02-requirements.md','03-state-machine.md','04-data-model.md','05-events.md','06-acceptance.md','07-open-questions.md']:
    assert (root/'docs'/name).exists(),name
print('SA contract and document presence: OK')
