"""Optional timed delivery rules for a game state."""

import random
from .constants import DISTANCES, GOODS, ISLANDS, MAX_DAYS
from .errors import GameError


class ContractRules:
    """Contract actions operating on the owning Game instance."""

    def current_offer(self) -> dict | None:
        """Generate a reproducible port offer without changing the game state."""
        if self.finished or self.active_contract:
            return None
        destinations = [i for i in range(len(ISLANDS))
                        if i != self.location and self.day + DISTANCES[self.location][i] <= MAX_DAYS]
        if not destinations:
            return None
        rng = random.Random(self.seed + self.day * 65537 + self.location * 4099)
        destination = rng.choice(destinations)
        good = rng.randrange(len(GOODS))
        quantity = rng.randint(3, 7)
        distance = DISTANCES[self.location][destination]
        return {"source": self.location, "destination": destination, "good": good,
                "quantity": quantity, "deadline": min(MAX_DAYS, self.day + distance + 2),
                "reward": 30 + distance * 26 + quantity * 6, "accepted_day": self.day}

    def accept_contract(self) -> str:
        self._active()
        if self.active_contract:
            raise GameError("Finish the current delivery before accepting another.")
        offer = self.current_offer()
        if offer is None:
            raise GameError("No delivery is available from this port today.")
        if self.cargo_used + offer["quantity"] > self.capacity:
            raise GameError("Not enough cargo space for the sealed delivery.")
        self.active_contract = offer
        return self._record(f"Accepted delivery of {offer['quantity']} {GOODS[offer['good']]} to "
                            f"{ISLANDS[offer['destination']]} by day {offer['deadline']} "
                            f"for {offer['reward']} coins.")

    def _resolve_contract(self) -> None:
        contract = self.active_contract
        if not contract:
            return
        if self.location == contract["destination"] and self.day <= contract["deadline"]:
            self.active_contract = None
            self.cash += contract["reward"]
            self.contracts_completed += 1
            self._record(f"DELIVERY COMPLETE — Earned {contract['reward']} coins at "
                         f"{ISLANDS[self.location]}.")
            self._check_milestones()
        elif self.day > contract["deadline"]:
            self.active_contract = None
            self.contracts_failed += 1
            self._record("DELIVERY EXPIRED — The sealed cargo was returned without payment.")

