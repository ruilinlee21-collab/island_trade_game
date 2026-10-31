"""Validated cosmetic ship choices shared by web views and save files."""

from .errors import GameError

DEFAULT_SHIP_STYLE = {"hull": "walnut", "sail": "ivory", "flag": "coral", "pattern": "plain"}
SHIP_OPTIONS = {
    "hull": ("walnut", "coral", "lagoon"),
    "sail": ("ivory", "sunset", "seafoam"),
    "flag": ("coral", "gold", "navy"),
    "pattern": ("plain", "stripe", "sunburst"),
}


def validate_ship_style(style: dict | None) -> dict[str, str]:
    """Return an independent, complete style or reject unsupported values."""
    if style is None:
        return DEFAULT_SHIP_STYLE.copy()
    if not isinstance(style, dict) or set(style) != set(SHIP_OPTIONS):
        raise GameError("Ship appearance must include hull, sail, flag and pattern.")
    if any(type(value) is not str or value not in SHIP_OPTIONS[key]
           for key, value in style.items()):
        raise GameError("Unknown ship appearance option.")
    return style.copy()
