"""A bounded, read-only route planner for cargo already on the ship."""

from .constants import CARGO_SLOT_COST, DISTANCES, GOODS, ISLANDS, MAX_DAYS, TRAVEL_DAY_COST
from .game import Game


def _leg_cost(game: Game, days: int, held: int, departure_day: int) -> int:
    """Estimate one leg using only a temporary effect already known today."""
    cost = days * TRAVEL_DAY_COST + held * CARGO_SLOT_COST
    effect = game.active_event
    if effect and departure_day < effect["until"]:
        if effect["kind"] == "fair_winds":
            cost -= 12
        elif effect["kind"] == "storm":
            cost += 18
    return max(0, cost)


def _new_trade_opportunity(game: Game) -> dict:
    """Find a feasible buy-and-sell journey when the ship is empty."""
    best = {"route": [], "sales": [], "buy": None, "estimated_sales": 0,
            "estimated_buy_cost": 0, "estimated_transport": 0,
            "estimated_net": 0, "advantage": 0, "travel_days": 0,
            "message": "No profitable route at today's prices. Wait for an event or explore a port."}
    for source in range(len(ISLANDS)):
        reposition_days = DISTANCES[game.location][source]
        reposition_cost = _leg_cost(game, reposition_days, 0, game.day) if reposition_days else 0
        if reposition_cost > game.cash:
            continue
        arrival_day = game.day + reposition_days
        fee = 1 if "trade_guild" in game.milestones else 2
        if (game.active_event and game.active_event["kind"] == "merchant_fair"
                and arrival_day < game.active_event["until"]):
            fee = 0
        for destination in range(len(ISLANDS)):
            if destination == source:
                continue
            sale_days = DISTANCES[source][destination]
            total_days = reposition_days + sale_days
            if total_days > MAX_DAYS - game.day:
                continue
            for good in range(len(GOODS)):
                limit = min(game.capacity, game.stock[source][good])
                buy_cost = 0
                for quantity in range(1, limit + 1):
                    buy_cost += game._price_for_stock(source, good, game.stock[source][good] - quantity + 1) + fee
                    sail_cost = _leg_cost(game, sale_days, quantity, arrival_day)
                    if reposition_cost + buy_cost + sail_cost > game.cash:
                        # Larger orders only cost more, so stop this quantity loop.
                        break
                    revenue = game.sell_price(destination, good) * quantity
                    profit = revenue - buy_cost - reposition_cost - sail_cost
                    if profit <= best["estimated_net"]:
                        continue
                    route = [ISLANDS[game.location]]
                    if source != game.location:
                        route.append(ISLANDS[source])
                    route.append(ISLANDS[destination])
                    best = {"route": route,
                            "buy": {"island": ISLANDS[source], "good": GOODS[good],
                                    "quantity": quantity, "cost": buy_cost},
                            "sales": [{"island": ISLANDS[destination],
                                       "items": [{"good": GOODS[good], "quantity": quantity,
                                                  "unit_price": game.sell_price(destination, good)}],
                                       "revenue": revenue}],
                            "estimated_sales": revenue, "estimated_buy_cost": buy_cost,
                            "estimated_transport": reposition_cost + sail_cost,
                            "estimated_net": profit, "advantage": profit,
                            "travel_days": total_days,
                            "message": "Potential profit from a new buy-and-sell journey."}
    return best


def recommend_sale_route(game: Game) -> dict:
    """Estimate a trade plan using at most two sailing legs.

    An empty ship gets an opening buy-and-sell scan; a loaded ship gets a
    recursive sale search. Both use today's prices and known travel effects.
    It ignores future stock recovery and unknown random events. No game state
    is changed. Recursive branches stop when time, cargo, or legs run out.

    Args:
        game: Current game state, which is read but never modified.
    Returns:
        A route, sale steps, estimated net receipts, and gain over selling here.
    """
    if game.active_contract:
        contract = game.active_contract
        return {"route": [], "sales": [], "buy": None, "estimated_sales": 0,
                "estimated_buy_cost": 0, "estimated_transport": 0,
                "estimated_net": 0, "advantage": 0, "travel_days": 0,
                "message": f"Deliver sealed cargo to {ISLANDS[contract['destination']]} by "
                           f"day {contract['deadline']} for {contract['reward']} coins. "
                           "Trade route estimates resume after delivery."}
    cargo = tuple(game.cargo)
    if not any(cargo):
        return _new_trade_opportunity(game)

    goods_mask = sum(1 << good for good, amount in enumerate(cargo) if amount > 0)
    sell_prices = tuple(tuple(game.sell_price(island, good) for good in range(len(GOODS)))
                        for island in range(len(ISLANDS)))
    local_value = sum(cargo[good] * sell_prices[game.location][good]
                      for good in range(len(GOODS)))
    best: dict = {"route": [ISLANDS[game.location]], "sales": [],
                  "estimated_sales": local_value, "estimated_transport": 0,
                  "estimated_net": local_value, "advantage": 0, "travel_days": 0,
                  "message": "Selling at the current port is the best known option."}

    def sale_step(island: int, mask: int) -> dict:
        items = [{"good": GOODS[good], "quantity": cargo[good],
                  "unit_price": sell_prices[island][good]}
                 for good in range(len(GOODS)) if mask & (1 << good) and cargo[good] > 0]
        return {"island": ISLANDS[island], "items": items,
                "revenue": sum(item["quantity"] * item["unit_price"] for item in items)}

    def search(location: int, remaining: int, visited: int, legs_left: int,
               elapsed: int, sales_total: int, transport_total: int,
               route: tuple[int, ...], steps: tuple[dict, ...]) -> None:
        nonlocal best
        # Base option: liquidate all remaining goods at the current port.
        final_step = sale_step(location, remaining)
        estimated_sales = sales_total + final_step["revenue"]
        net = estimated_sales - transport_total
        if net > best["estimated_net"]:
            best = {"route": [ISLANDS[island] for island in route],
                    "sales": [*steps, final_step], "estimated_sales": estimated_sales,
                    "estimated_transport": transport_total, "estimated_net": net,
                    "advantage": net - local_value, "travel_days": elapsed,
                    "message": "Estimated gain compared with selling everything here."}

        # Stopping condition keeps recursion shallow and respects the deadline.
        if legs_left == 0 or remaining == 0 or elapsed >= MAX_DAYS - game.day:
            return

        # Recursive case: sell any subset here, then sail with the rest.
        for sold_here in range(remaining):
            if sold_here & ~remaining:
                continue
            left = remaining ^ sold_here
            sold_step = sale_step(location, sold_here)
            available_cash = game.cash + sales_total + sold_step["revenue"] - transport_total
            held = sum(cargo[good] for good in range(len(GOODS)) if left & (1 << good))
            next_steps = steps + ((sold_step,) if sold_step["items"] else ())
            for destination in range(len(ISLANDS)):
                if visited & (1 << destination):
                    continue
                days = DISTANCES[location][destination]
                if elapsed + days > MAX_DAYS - game.day:
                    continue
                leg_cost = _leg_cost(game, days, held, game.day + elapsed)
                if available_cash < leg_cost:
                    continue
                search(destination, left, visited | (1 << destination), legs_left - 1,
                       elapsed + days, sales_total + sold_step["revenue"],
                       transport_total + leg_cost, route + (destination,), next_steps)

    search(game.location, goods_mask, 1 << game.location, 2, 0, 0, 0,
           (game.location,), ())
    if not best["sales"]:
        best["sales"] = [sale_step(game.location, goods_mask)]
    return best
