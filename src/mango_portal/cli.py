# Example: mango_portal/cli.py
import click
from mango_lib.cli.base import mango


@click.group("portal")
def portal() -> None:
    """ManGO Portal commands."""
    pass


@portal.command()
@click.option("--host", default="localhost", help="Portal host.")
def serve(host: str) -> None:
    """Start the ManGO Portal server."""
    click.echo(f"Starting portal on {host}")

def register():
    """Register the portal command group with the main CLI."""
    mango.add_command(portal)