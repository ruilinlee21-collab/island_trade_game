"""Public game API used by the command-line and web entry points."""

from .errors import GameError
from .game import Game

__all__ = ["Game", "GameError"]
