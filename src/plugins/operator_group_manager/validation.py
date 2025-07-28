from typing import Annotated, Tuple, Union

import yaml
from pydantic import Field, RootModel, ValidationError


def validate_user_management_yaml(yaml_string: str) -> Tuple[bool, str]:
    try:
        yaml_contents = yaml.safe_load(yaml_string)
    except Exception as e:
        return False, f"Error reading the YAML, {e}"
    validated_yaml = validate_user_management(yaml_contents)
    if isinstance(validated_yaml, str):
        return False, validated_yaml
    return True, yaml_string  # no errors, return clean string to save to file


def validate_user_management(yaml_contents: dict) -> dict:
    User = Annotated[str, Field(pattern=r"^([urbx]\d{7})|(vsc\d{5})|\w+_pipeline$")]
    Group = Annotated[str, Field(pattern=r"^[\w]+$")]
    UserManagement = RootModel[dict[Group, Union[list[User], "UserManagement"]]]

    try:
        return UserManagement(yaml_contents).model_dump()
    except ValidationError as e:
        return f"The YAML is not in the correct format, {e}"
    except Exception as e:
        return f"There is something wrong with the YAML, {e}"
