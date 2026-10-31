"""Run this file for the standard-library command-line game or web interface.

Usage: python3 main.py           (terminal game)
       python3 main.py --web     (local web game)
       python3 main.py --web --shipyard --map --open  (ship designer, then map)
"""

import argparse
from pathlib import Path
from island_trade import Game, GameError
from island_trade.advisor import recommend_sale_route
from island_trade.constants import DISTANCES, GOODS, ISLANDS

SAVE_PATH = Path(__file__).parent / "savegame.json"


def show(game: Game) -> None:
    print(f"\nDAY {min(game.day, 30)}/30 | {ISLANDS[game.location]} | Cash {game.cash} | Cargo {game.cargo_used}/{game.capacity}")
    print("Good         Buy   Sell   Stock   Held")
    for index, name in enumerate(GOODS):
        print(f"{index + 1}. {name:<10} {game.price(game.location, index):>3}   "
              f"{game.sell_price(game.location, index):>3}   {game.stock[game.location][index]:>5}   {game.cargo[index]:>4}")
    print("Routes:", ", ".join(f"{i + 1} {name} ({DISTANCES[game.location][i]}d)"
                                 for i, name in enumerate(ISLANDS) if i != game.location))
    if game.event_history:
        latest = game.event_history[0]
        print(f"Latest event (day {latest['day']}): {latest['title']} — {latest['description']}")
    if game.active_event:
        remaining = game.active_event["until"] - game.day
        if remaining > 0:
            print(f"Temporary effect: {game.active_event['kind'].replace('_', ' ')} ({remaining} day(s) left)")
    print(f"Milestones: {', '.join(game.milestones) or 'none yet'} | Buying fee: {game.buy_fee} coin(s)")
    if game.active_contract:
        offer = game.active_contract
        print(f"Delivery: {offer['quantity']} {GOODS[offer['good']]} to {ISLANDS[offer['destination']]} "
              f"by day {offer['deadline']} for {offer['reward']} coins (sealed cargo)")
    elif (offer := game.current_offer()) is not None:
        print(f"Available delivery: {offer['quantity']} {GOODS[offer['good']]} to "
              f"{ISLANDS[offer['destination']]} by day {offer['deadline']} "
              f"for {offer['reward']} coins. Type contract to accept.")
    print(f"Deliveries: {game.contracts_completed} completed, {game.contracts_failed} expired")
    if game.finished:
        print("VOYAGE COMPLETE", game.summary())


def choose_number(prompt: str) -> int:
    try:
        return int(input(prompt).strip())
    except ValueError as exc:
        raise GameError("Please enter a whole number.") from exc


def cli() -> None:
    game = Game()
    print("ISLAND TRADE TYCOON — 30 days to grow your assets")
    print("Commands: buy, sell, sail, wait, upgrade, contract, advice, save, load, status, quit")
    while True:
        show(game)
        try:
            command = input("\nCommand > ").strip().lower()
            if command == "quit":
                break
            if command in ("buy", "sell"):
                good = choose_number("Good number (1-4): ") - 1
                quantity = choose_number("Quantity: ")
                print(getattr(game, command)(good, quantity))
            elif command == "sail":
                print(game.travel(choose_number("Island number (1-5): ") - 1))
            elif command == "wait":
                print(game.wait())
            elif command == "upgrade":
                print(game.upgrade())
            elif command == "contract":
                print(game.accept_contract())
            elif command == "save":
                game.save(SAVE_PATH); print(f"Saved to {SAVE_PATH.name}.")
            elif command == "load":
                game = Game.load(SAVE_PATH); print("Save loaded.")
            elif command == "status":
                print(game.summary())
            elif command == "advice":
                plan = recommend_sale_route(game)
                print(plan["message"])
                if plan["route"]:
                    print("Route:", " -> ".join(plan["route"]))
                    if plan.get("buy"):
                        buy = plan["buy"]
                        print(f"  Buy {buy['quantity']} {buy['good']} at {buy['island']} for about {buy['cost']} coins")
                    for step in plan["sales"]:
                        items = ", ".join(f"{item['quantity']} {item['good']}" for item in step["items"])
                        print(f"  Sell {items} at {step['island']} for about {step['revenue']} coins")
                    label = "Projected profit" if plan.get("buy") else "Projected gain over selling here"
                    print(f"{label}: {plan['advantage']} coins")
            else:
                print("Unknown command. Try buy, sell, sail, wait, upgrade, contract, advice, save, load, status, quit.")
        except (GameError, EOFError, KeyboardInterrupt) as exc:
            if isinstance(exc, (EOFError, KeyboardInterrupt)):
                print("\nGoodbye!"); break
            print(f"Cannot do that: {exc}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Island Trade Tycoon")
    parser.add_argument("--web", action="store_true", help="Launch local browser interface")
    parser.add_argument("--map", action="store_true", help="Open the interactive map interface with --web")
    parser.add_argument("--shipyard", action="store_true", help="Open the ship designer before a new voyage with --web")
    parser.add_argument("--open", action="store_true", help="Open the local game in your default browser")
    parser.add_argument("--port", type=int, default=8765, help="Local web port (default: 8765)")
    args = parser.parse_args()
    if args.web:
        from island_trade.web import serve
        serve(args.port, open_browser=args.open, map_view=args.map, shipyard=args.shipyard)
    else:
        cli()


if __name__ == "__main__":
    main()
