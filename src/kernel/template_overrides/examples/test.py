import yaml
import pathlib
import pprint


myrules_path = pathlib.Path("my_override_rules.yml")
myrule_blocks = [block for block in yaml.safe_load_all(myrules_path.read_text())]
for block in myrule_blocks:
    print(type(block))
print(yaml.safe_dump(myrule_blocks, sort_keys=False, allow_unicode=True))
pprint.pprint(myrule_blocks, sort_dicts=False)
