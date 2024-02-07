"""
Template override system:
Collection and data object views and other template calls can be changed by overriding the corresponding
jinja2 template based on several rules (or no real rule at all for permanent overrides)
"""
from app import app
from irods.collection import iRODSCollection
from irods.data_object import iRODSDataObject
import os, pathlib, yaml, collections, logging

MANGO_OVERRIDE_TEMPLATE_AVU = "mg.template_override"
MANGO_OVERRIDE_SOURCE_TEMPLATES = (
    "data_object_view",
    "collection_view",
    "data_object_content",
    "collection_content",
)
with app.app_context():
    MANGO_OVERRIDE_TEMPLATE_RULES_CONFIG = app.config.get(
        "MANGO_OVERRIDE_TEMPLATE_RULES_CONFIG", "config/template_override_rules.yml"
    )

override_rule_blocks = {}
override_rule_blocks_path = pathlib.Path(MANGO_OVERRIDE_TEMPLATE_RULES_CONFIG)
if override_rule_blocks_path.exists():
    override_rule_blocks_list = [
        zone_block
        for zone_block in yaml.safe_load_all(override_rule_blocks_path.read_text())
    ]
    override_rule_blocks = {
        zone_block["zone"]: zone_block for zone_block in override_rule_blocks_list
    }
    logging.info(f"Found template override config file {override_rule_blocks_path}")
else:
    logging.warn(
        f"No template override configuration found: {override_rule_blocks_path}"
    )


class TemplateOverrideManager:
    """
    view templates and selected components can be overridden based on either a dedicated metadata item or
    through a rule that involves several criteria

    """

    def __init__(self, irods_zone: str) -> None:
        self.zone = irods_zone
        self.rules = collections.defaultdict(list)
        # initialise the basics
        for zone in [irods_zone, "all"]:
            if zone in override_rule_blocks:
                for _label, override_item in override_rule_blocks[zone].items():
                    if _label in ["zone"]:
                        continue
                    self.rules[override_item["source"]].append(
                        {
                            "target": override_item["target"],
                            "matches": override_item["matches"]
                            if "matches" in override_item
                            else None,
                        }
                    )

    def check_rules(
        self, catalog_item: iRODSDataObject | iRODSCollection, matches: str
    ) -> bool:
        # no checks needed for global overrides
        if type(matches) == str and matches == "always":
            return True

        # process AND match patters aka all
        def match_item(match_key: str, match_value: str):
            match match_key:
                case "name":
                    return (
                        type(match_value) == list and catalog_item.name in match_value
                    ) or (type(match_value) == str and catalog_item.name == match_value)
                case "metadata":
                    metadata_matches = []
                    for metadata_pair in match_value["items"]:
                        meta_name = list(metadata_pair.keys())[0]
                        meta_value = metadata_pair[meta_name]
                        try:
                            avus = catalog_item.metadata.get_all(meta_name)
                        except Exception as e:
                            # metadata_matches.append(False)
                            break
                        # loop over avus, if multivalued, we consider one match enough
                        avu_match = False
                        for avu in avus:
                            if meta_name == avu.name:
                                if (
                                    type(meta_value) == list and avu.value in meta_value
                                ) or (
                                    type(meta_value) == str and avu.value == meta_value
                                ):
                                    avu_match = True
                                    print(f"we have a match!!")
                                    break
                        metadata_matches.append(avu_match)
                    if (
                        "match_type" in match_value
                        and match_value["match_type"] == "all"
                    ):
                        return all(metadata_matches)
                    return any(metadata_matches)
                case "path":
                    return (
                        type(match_value) == list and catalog_item.path in match_value
                    ) or (type(match_value) == str and catalog_item.path == match_value)
                case "subtree":
                    # For subtree lists, one of the items must match
                    logging.info(f"Entering subtree rule for override {match_value}")
                    if type(match_value) == list:
                        for subtree in match_value:
                            subtree = subtree.replace(
                                "{{zone}}", self.zone
                            )  # expand any <<zone>> specifier with the actual zone

                            if catalog_item.path.startswith(subtree):
                                return True

                    if type(match_value) == str:
                        match_value = match_value.replace("{{zone}}", self.zone)
                        return catalog_item.path.startswith(match_value)
                case _:
                    logging.warn(
                        f"Unsupported match method {match_key} in template overrides"
                    )

        match_result = {}
        if "all" in matches:
            match_list = []
            for match_key, match_value in matches["all"].items():
                match_item_result = match_item(match_key, match_value)
                if type(match_item_result) == list:
                    match_list += match_item_result
                else:
                    match_list += [match_item_result]
            match_result["all"] = all(match_list)

        if "any" in matches:
            match_result["any"] = False
            # match_list=[]
            for match_key, match_value in matches["any"].items():
                match_item_result = match_item(match_key, match_value)
                if (type(match_item_result) == list and any(match_item_result)) or (
                    match_item_result
                ):
                    match_result["any"] = True
        return all(
            match_result.values()
        )  # if the all section exists it will be added and needs to be set

    def get_template_for_catalog_item(
        self, catalog_item: iRODSDataObject | iRODSCollection, source_template_path
    ) -> str:
        # First check if there is a dedicated override
        try:
            override_template_avus = catalog_item.metadata.get_all(
                MANGO_OVERRIDE_TEMPLATE_AVU
            )
            for override_template_avu in override_template_avus:
                try:
                    (source, target) = override_template_avu.split(":")
                    if source.trim() == source_template_path:
                        return target.trim()
                except:
                    pass

        except Exception as e:
            # logging.debug(
            #     f"No dedicated template definition found in metadata for {catalog_item.path}: {e}"
            # )
            pass

        # check if there exists a rule for this template
        if source_template_path not in self.rules:
            logging.debug(f"No source path {source_template_path} in rules")
            return source_template_path

        if source_template_path in self.rules:
            # print(json.dumps(self.rules[source_template_path], indent=3))
            # logging.warning("No matches in template override rule")
            # return source_template_path
            # now the real rule processing
            for rule_set in self.rules[source_template_path]:
                if "matches" in rule_set and self.check_rules(
                    catalog_item=catalog_item, matches=rule_set["matches"]
                ):
                    # logging.info(
                    #     f"Rule matched for {catalog_item.path}: source {source_template_path} -> {rule_set['target']}"
                    # )
                    return rule_set["target"]
        # so nothing matches, return the source_path
        return source_template_path


template_override_managers = {
    zone: TemplateOverrideManager(zone) for zone in override_rule_blocks
}


def get_template_override_manager(zone: str):
    if zone not in template_override_managers:
        template_override_managers[zone] = TemplateOverrideManager(zone)
    return template_override_managers[zone]


logging.info(
    f"Template override managers: found dedicated configs for zones {list(template_override_managers.keys())}"
)

from flask import Blueprint

template_overrides_bp = Blueprint("template_overrides_bp", __name__)


@template_overrides_bp.app_template_filter(name="mango_template")
def mango_template_override_filter(
    template: str, zone: str, catalog_item: iRODSDataObject | iRODSCollection = None
) -> str:
    return get_template_override_manager(zone).get_template_for_catalog_item(
        catalog_item, template
    )

