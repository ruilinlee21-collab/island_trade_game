"""Game state and player actions shared by the CLI and web UI."""

from dataclasses import dataclass, field
import secrets
from .constants import (BASE_PRICE, BASE_STOCK, CARGO_SLOT_COST, DISTANCES, GOODS,
                        ISLANDS, MAX_DAYS, TRAVEL_DAY_COST)
from .contracts import ContractRules
from .errors import GameError
from .events import EventRules
from .storage import SaveMixin
from .ship import DEFAULT_SHIP_STYLE, validate_ship_style


@dataclass
class Game(ContractRules, EventRules, SaveMixin):
    """One voyage; specialized rule classes supply contracts, events, and saves."""
    day: int = 1
    location: int = 0
    cash: int = 500
    capacity: int = 20
    cargo: list[int] = field(default_factory=lambda: [0] * len(GOODS))
    stock: list[list[int]] = field(default_factory=lambda: [list(row) for row in BASE_STOCK])
    upgrades: int = 0
    trades: int = 0
    log: list[str] = field(default_factory=lambda: ["Welcome to Coral Bay. Your 30-day voyage begins!"])
    seed: int = field(default_factory=lambda: secrets.randbelow(2**31))
    milestones: list[str] = field(default_factory=list)
    event_history: list[dict] = field(default_factory=list)
    active_event: dict | None = None
    event_count: int = 0
    active_contract: dict | None = None
    contracts_completed: int = 0
    contracts_failed: int = 0
    ship_style: dict[str, str] = field(default_factory=lambda: DEFAULT_SHIP_STYLE.copy())

    def __post_init__(self) -> None:
        self.ship_style = validate_ship_style(self.ship_style)

    def customize_ship(self, style: dict) -> str:
        """Change only the ship's appearance; trading state is untouched."""
        self.ship_style = validate_ship_style(style)
        return self._record("Ship appearance updated at the shipyard.")

    @property
    def finished(self) -> bool:
        return self.day > MAX_DAYS

    @property
    def cargo_used(self) -> int:
        return sum(self.cargo) + (self.active_contract["quantity"] if self.active_contract else 0)

    @property
    def buy_fee(self) -> int:
        fee = 1 if "trade_guild" in self.milestones else 2
        if (self.active_event and self.day < self.active_event["until"]
                and self.active_event["kind"] == "merchant_fair"):
            fee = 0
        return fee

    def transport_cost(self, destination: int) -> int:
        if type(destination) is not int or not 0 <= destination < len(ISLANDS):
            raise GameError("Unknown destination.")
        days = DISTANCES[self.location][destination]
        if days == 0:
            return 0
        cost = days * TRAVEL_DAY_COST + self.cargo_used * CARGO_SLOT_COST
        if self.active_event and self.day < self.active_event["until"]:
            if self.active_event["kind"] == "fair_winds":
                cost -= 12
            elif self.active_event["kind"] == "storm":
                cost += 18
        return max(0, cost)

    def price(self, island: int, good: int) -> int:
        self._index(island, good)
        return self._price_for_stock(island, good, self.stock[island][good])

    @staticmethod
    def _price_for_stock(island: int, good: int, stock: int) -> int:
        target = BASE_STOCK[island][good]
        scarcity = (target - stock) * BASE_PRICE[good] // target
        # Island specialisation creates routes even before players change stock.
        local_supply = (28 - target) * BASE_PRICE[good] // 84
        return max(3, BASE_PRICE[good] + local_supply + scarcity // 2)

    def sell_price(self, island: int, good: int) -> int:
        return max(1, self.price(island, good) * 9 // 10)

    def _index(self, island: int, good: int) -> None:
        if not 0 <= island < len(ISLANDS) or not 0 <= good < len(GOODS):
            raise GameError("Unknown island or good.")

    def _quantity(self, quantity: int) -> None:
        if type(quantity) is not int or quantity <= 0:
            raise GameError("Quantity must be a positive whole number.")

    def _active(self) -> None:
        if self.finished:
            raise GameError("The 30-day voyage is over. Start a new game to play again.")

    def buy(self, good: int, quantity: int) -> str:
        self._active()
        self._index(self.location, good)
        self._quantity(quantity)
        if self.stock[self.location][good] < quantity:
            raise GameError("The market does not have enough stock.")
        if self.cargo_used + quantity > self.capacity:
            raise GameError("Not enough cargo space.")
        # A bulk order changes the market as units are purchased.
        starting_stock = self.stock[self.location][good]
        cost = sum(self._price_for_stock(self.location, good, starting_stock - n) + self.buy_fee
                   for n in range(quantity))
        if self.cash < cost:
            raise GameError("Not enough cash.")
        self.cash -= cost
        self.cargo[good] += quantity
        self.stock[self.location][good] -= quantity
        self.trades += 1
        message = self._record(f"Bought {quantity} {GOODS[good]} for {cost} coins.")
        self._check_milestones()
        return message

    def sell(self, good: int, quantity: int) -> str:
        self._active()
        self._index(self.location, good)
        self._quantity(quantity)
        if self.cargo[good] < quantity:
            raise GameError("You do not carry enough of that good.")
        revenue = self.sell_price(self.location, good) * quantity
        self.cash += revenue
        self.cargo[good] -= quantity
        self.stock[self.location][good] += quantity
        self.trades += 1
        message = self._record(f"Sold {quantity} {GOODS[good]} for {revenue} coins.")
        self._check_milestones()
        return message

    def travel(self, destination: int) -> str:
        self._active()
        if type(destination) is not int or not 0 <= destination < len(ISLANDS):
            raise GameError("Unknown destination.")
        days = DISTANCES[self.location][destination]
        if days == 0:
            raise GameError("You are already at this island.")
        if self.day + days > MAX_DAYS + 1:
            raise GameError("Not enough days remain for this voyage.")
        cost = self.transport_cost(destination)
        if self.cash < cost:
            raise GameError("Not enough cash for transport.")
        self.cash -= cost
        self._advance(days)
        self.location = destination
        unit = "day" if days == 1 else "days"
        message = self._record(f"Sailed {days} {unit} to {ISLANDS[destination]} for {cost} coins.")
        self._resolve_contract()
        return message

    def wait(self) -> str:
        self._active()
        self._advance(1)
        message = self._record("Spent one day watching the markets.")
        self._resolve_contract()
        return message

    def upgrade(self) -> str:
        self._active()
        cost = 180 + 120 * self.upgrades
        if self.cash < cost:
            raise GameError(f"A cargo upgrade costs {cost} coins.")
        self.cash -= cost
        self.capacity += 10
        self.upgrades += 1
        return self._record(f"Cargo upgraded to {self.capacity} slots for {cost} coins.")

    def _advance(self, days: int) -> None:
        for _ in range(days):
            # Every island/good pair recovers one unit toward its normal stock each day.
            for island, row in enumerate(self.stock):
                for good, amount in enumerate(row):
                    target = BASE_STOCK[island][good]
                    row[good] += (target > amount) - (target < amount)
            self.day += 1
            if self.active_event and self.day >= self.active_event["until"]:
                self._record("The temporary market effect has ended.")
                self.active_event = None
            if self.day <= MAX_DAYS:
                self._roll_event()

    def _check_milestones(self) -> None:
        if self.trades >= 5 and "trade_guild" not in self.milestones:
            self.milestones.append("trade_guild")
            self._record("MILESTONE — Trade Guild: buying fees fall to 1 coin per unit.")
        if self.trades >= 12 and "royal_charter" not in self.milestones:
            self.milestones.append("royal_charter")
            self.cash += 100
            self._record("MILESTONE — Royal Charter: earned a one-time 100 coin grant.")
        if self.summary()["assets"] >= 800 and "first_fleet" not in self.milestones:
            self.milestones.append("first_fleet")
            self.capacity += 5
            self._record("MILESTONE — First Fleet: earned 5 permanent cargo slots.")

    def _record(self, message: str) -> str:
        self.log.append(f"Day {min(self.day, MAX_DAYS)}: {message}")
        self.log = self.log[-12:]
        return message

    def summary(self) -> dict:
        cargo_value = sum(self.sell_price(self.location, i) * amount for i, amount in enumerate(self.cargo))
        return {"cash": self.cash, "cargo_value": cargo_value, "assets": self.cash + cargo_value,
                "trades": self.trades, "upgrades": self.upgrades, "days_used": min(self.day - 1, MAX_DAYS),
                "contracts_completed": self.contracts_completed, "contracts_failed": self.contracts_failed}

    def public_state(self) -> dict:
        from .advisor import recommend_sale_route

        milestone_progress = [
            {"id": "trade_guild", "title": "Trade Guild", "target": 5,
             "current": min(self.trades, 5), "reward": "Buying fee −1", "achieved": "trade_guild" in self.milestones},
            {"id": "first_fleet", "title": "First Fleet", "target": 800,
             "current": min(self.summary()["assets"], 800), "reward": "+5 cargo slots", "achieved": "first_fleet" in self.milestones},
            {"id": "royal_charter", "title": "Royal Charter", "target": 12,
             "current": min(self.trades, 12), "reward": "+100 coins", "achieved": "royal_charter" in self.milestones},
        ]
        return {"day": self.day, "max_days": MAX_DAYS, "location": self.location,
                "islands": ISLANDS, "goods": GOODS, "cash": self.cash, "capacity": self.capacity,
                "cargo": self.cargo, "cargo_used": self.cargo_used, "stock": self.stock,
                "prices": [[self.price(i, j) for j in range(4)] for i in range(5)],
                "sell_prices": [[self.sell_price(i, j) for j in range(4)] for i in range(5)],
                "distances": DISTANCES, "upgrade_cost": 180 + 120 * self.upgrades,
                "buy_fee": self.buy_fee,
                "transport_costs": [self.transport_cost(i) for i in range(5)],
                "event_history": self.event_history, "event_count": self.event_count,
                "active_event": ({**self.active_event, "remaining": self.active_event["until"] - self.day}
                                 if self.active_event and self.day < self.active_event["until"] else None),
                "milestone_progress": milestone_progress,
                "contract_offer": self.current_offer(), "active_contract": self.active_contract,
                "contracts_completed": self.contracts_completed,
                "contracts_failed": self.contracts_failed,
                "advice": recommend_sale_route(self),
                "ship_style": self.ship_style,
                "finished": self.finished, "summary": self.summary(), "log": self.log}
