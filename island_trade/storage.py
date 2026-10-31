"""Versioned JSON persistence and validation for game state."""

from copy import deepcopy
import json
from pathlib import Path
from .constants import EVENT_KINDS, GOODS, ISLANDS, MAX_DAYS, SAVE_VERSION
from .errors import GameError
from .ship import DEFAULT_SHIP_STYLE


class SaveMixin:
    """Versioned save/load methods shared with Game."""

    def to_dict(self) -> dict:
        return {"version": SAVE_VERSION, "day": self.day, "location": self.location,
                "cash": self.cash, "capacity": self.capacity, "cargo": self.cargo,
                "stock": self.stock, "upgrades": self.upgrades, "trades": self.trades,
                "log": self.log, "seed": self.seed, "milestones": self.milestones,
                "event_history": self.event_history, "active_event": self.active_event,
                "event_count": self.event_count, "active_contract": self.active_contract,
                "contracts_completed": self.contracts_completed, "contracts_failed": self.contracts_failed,
                "ship_style": self.ship_style}

    @classmethod
    def from_dict(cls, data: dict) -> "SaveMixin":
        if not isinstance(data, dict) or data.get("version") not in (1, 2, 3, SAVE_VERSION):
            raise GameError("Unsupported or invalid save file.")
        try:
            data = deepcopy(data)
            old_version = data["version"]
            if old_version == 1:
                # Keep saves made by the original release playable.
                data = dict(data)
                data.update(version=SAVE_VERSION,
                            seed=(data["day"] * 131 + data["cash"] * 17 + data["trades"] * 37) % (2**31),
                            milestones=[], event_history=[], active_event=None, event_count=0)
            if old_version in (1, 2):
                data.update(version=SAVE_VERSION, active_contract=None,
                            contracts_completed=0, contracts_failed=0)
            if old_version < 4:
                data.update(version=SAVE_VERSION, ship_style=DEFAULT_SHIP_STYLE.copy())
            fields = ("day", "location", "cash", "capacity", "cargo", "stock",
                      "upgrades", "trades", "log", "seed", "milestones",
                      "event_history", "active_event", "event_count", "active_contract",
                      "contracts_completed", "contracts_failed", "ship_style")
            game = cls(**{key: data[key] for key in fields})
            valid_events = ("fair_winds", "storm", "merchant_fair")
            active_valid = (game.active_event is None or
                            (isinstance(game.active_event, dict)
                             and game.active_event.get("kind") in valid_events
                             and type(game.active_event.get("until")) is int
                             and game.day <= game.active_event["until"] <= MAX_DAYS + 2))
            history_valid = (isinstance(game.event_history, list)
                             and len(game.event_history) <= 8
                             and all(isinstance(event, dict)
                                     and type(event.get("day")) is int
                                     and 2 <= event["day"] <= MAX_DAYS
                                     and event.get("kind") in EVENT_KINDS
                                     and isinstance(event.get("title"), str)
                                     and isinstance(event.get("description"), str)
                                     for event in game.event_history))
            contract = game.active_contract
            contract_valid = (contract is None or
                              (isinstance(contract, dict)
                               and set(contract) == {"source", "destination", "good", "quantity",
                                                     "deadline", "reward", "accepted_day"}
                               and all(type(contract[key]) is int for key in contract)
                               and 0 <= contract["source"] < len(ISLANDS)
                               and 0 <= contract["destination"] < len(ISLANDS)
                               and contract["source"] != contract["destination"]
                               and 0 <= contract["good"] < len(GOODS)
                               and 1 <= contract["quantity"] <= 7
                               and 1 <= contract["accepted_day"] <= game.day <= contract["deadline"] <= MAX_DAYS
                               and contract["reward"] > 0))
            if not (type(game.day) is int and 1 <= game.day <= 31 and type(game.location) is int and 0 <= game.location < 5
                    and type(game.cash) is int and game.cash >= 0 and type(game.capacity) is int and game.capacity >= 20
                    and len(game.cargo) == 4 and all(type(x) is int and x >= 0 for x in game.cargo)
                    and game.cargo_used <= game.capacity and len(game.stock) == 5
                    and all(len(row) == 4 and all(type(x) is int and x >= 0 for x in row) for row in game.stock)
                    and type(game.upgrades) is int and game.upgrades >= 0
                    and isinstance(game.milestones, list)
                    and len(game.milestones) == len(set(game.milestones))
                    and all(x in ("trade_guild", "first_fleet", "royal_charter") for x in game.milestones)
                    and game.capacity == 20 + game.upgrades * 10 + (5 if "first_fleet" in game.milestones else 0)
                    and type(game.trades) is int and game.trades >= 0 and isinstance(game.log, list)
                    and all(isinstance(x, str) for x in game.log)
                    and type(game.seed) is int and 0 <= game.seed < 2**31
                    and type(game.event_count) is int and game.event_count >= len(game.event_history)
                    and history_valid and active_valid and contract_valid
                    and type(game.contracts_completed) is int and game.contracts_completed >= 0
                    and type(game.contracts_failed) is int and game.contracts_failed >= 0):
                raise ValueError("Invalid game state")
            return game
        except (KeyError, TypeError, ValueError, GameError) as exc:
            raise GameError("Save file contains invalid game data.") from exc

    def save(self, path: Path) -> None:
        path = Path(path)
        temporary = path.with_name(path.name + ".tmp")
        try:
            path.parent.mkdir(parents=True, exist_ok=True)
            temporary.write_text(json.dumps(self.to_dict(), indent=2), encoding="utf-8")
            temporary.replace(path)
        except OSError as exc:
            temporary.unlink(missing_ok=True)
            raise GameError(f"Could not save game: {exc}") from exc

    @classmethod
    def load(cls, path: Path) -> "SaveMixin":
        try:
            return cls.from_dict(json.loads(Path(path).read_text(encoding="utf-8")))
        except (OSError, json.JSONDecodeError) as exc:
            raise GameError(f"Could not read save file: {exc}") from exc

