"""Seeded random market and weather events."""

import random
from .constants import EVENT_CHANCE, EVENT_KINDS, ISLANDS


class EventRules:
    """Seeded events operating on the owning Game instance."""

    def _roll_event(self) -> None:
        """Use the saved seed and day, so reloading cannot reroll an outcome."""
        rng = random.Random(self.seed + self.day * 104729)
        if rng.random() >= EVENT_CHANCE:
            return
        kind = rng.choice(EVENT_KINDS)
        island = rng.randrange(len(ISLANDS))
        if kind == "fish_glut":
            self.stock[island][0] += 12
            title = "Bountiful Catch"
            detail = f"{ISLANDS[island]} gained 12 Fish. Its fish price dropped."
        elif kind == "spice_festival":
            amount = min(8, self.stock[island][3])
            self.stock[island][3] -= amount
            title = "Spice Festival"
            detail = f"Celebrations in {ISLANDS[island]} used {amount} Spices. Prices rose."
        elif kind == "timber_delivery":
            self.stock[island][2] += 10
            title = "Timber Convoy"
            detail = f"{ISLANDS[island]} received 10 Wood. Look for a bargain."
        elif kind == "coconut_festival":
            amount = min(10, self.stock[island][1])
            self.stock[island][1] -= amount
            title = "Coconut Festival"
            detail = f"{ISLANDS[island]} consumed {amount} Coconuts. Demand is high."
        else:
            if self.active_event:
                # A supply shock can occur without cutting an existing travel effect short.
                self.stock[island][0] += 8
                kind = "fish_glut"
                title = "Extra Fishing Fleet"
                detail = f"{ISLANDS[island]} gained 8 Fish while the current effect continues."
            else:
                title, detail = {
                    "fair_winds": ("Fair Winds", "Sailing costs 12 fewer coins for two days."),
                    "storm": ("Harbor Storm", "Sailing costs 18 extra coins for two days."),
                    "merchant_fair": ("Merchant Fair", "Buying fees are waived for two days."),
                }[kind]
                self.active_event = {"kind": kind, "until": self.day + 2}
        event = {"day": self.day, "kind": kind, "title": title, "description": detail}
        self.event_history.insert(0, event)
        self.event_history = self.event_history[:8]
        self.event_count += 1
        self._record(f"EVENT — {title}: {detail}")

