"""Meaningful rule tests; run with python3 -m unittest discover -s tests -v."""

import tempfile
import unittest
from pathlib import Path

from island_trade.game import Game, GameError


class GameTests(unittest.TestCase):
    def test_trade_changes_stock_and_price(self):
        game = Game()
        before = game.price(0, 0)
        game.buy(0, 5)
        self.assertEqual(game.cargo[0], 5)
        self.assertEqual(game.stock[0][0], 37)
        self.assertGreaterEqual(game.price(0, 0), before)
        game.sell(0, 3)
        self.assertEqual(game.cargo[0], 2)
        self.assertEqual(game.stock[0][0], 40)

    def test_travel_advances_days_and_pays_cost(self):
        game = Game()
        game.buy(0, 2)
        cash = game.cash
        game.travel(1)
        self.assertEqual(game.day, 2)
        self.assertEqual(game.location, 1)
        self.assertEqual(game.cash, cash - 16)

    def test_invalid_actions_do_not_mutate_state(self):
        game = Game()
        initial = game.to_dict()
        for action in (lambda: game.buy(0, 999), lambda: game.sell(2, 1),
                       lambda: game.travel(0), lambda: game.buy(0, -1)):
            with self.assertRaises(GameError):
                action()
            self.assertEqual(game.to_dict(), initial)

    def test_save_roundtrip_and_corrupt_file(self):
        game = Game()
        game.buy(0, 2)
        game.travel(1)
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "voyage.json"
            game.save(path)
            self.assertEqual(Game.load(path).to_dict(), game.to_dict())
            path.write_text("not json", encoding="utf-8")
            with self.assertRaises(GameError):
                Game.load(path)

    def test_end_of_voyage_has_final_assets(self):
        game = Game(day=30)
        game.wait()
        self.assertTrue(game.finished)
        self.assertEqual(game.summary()["assets"], game.cash)
        with self.assertRaises(GameError):
            game.wait()

    def test_seeded_market_event_and_save_preserve_future(self):
        game = Game(seed=9)
        game.wait()
        self.assertEqual(game.event_history[0]["kind"], "fish_glut")
        self.assertEqual(game.stock[0][0], 54)
        self.assertLess(game.price(0, 0), Game(seed=9).price(0, 0))
        restored = Game.from_dict(game.to_dict())
        game.wait()
        restored.wait()
        self.assertEqual(restored.to_dict(), game.to_dict())

    def test_temporary_event_affects_cost_then_expires(self):
        storm = Game(seed=2)
        storm.wait()
        self.assertEqual(storm.active_event["kind"], "storm")
        self.assertEqual(storm.transport_cost(1), 32)
        storm.wait()
        storm.wait()
        self.assertEqual(storm.transport_cost(1), 14)
        self.assertIsNone(storm.active_event)
        fair = Game(seed=13)
        fair.wait()
        self.assertEqual(fair.buy_fee, 0)

    def test_milestones_unlock_once(self):
        game = Game(seed=1)
        for _ in range(3):
            game.buy(0, 1)
            game.sell(0, 1)
        self.assertIn("trade_guild", game.milestones)
        self.assertEqual(game.buy_fee, 1)
        self.assertEqual(game.milestones.count("trade_guild"), 1)
        wealthy = Game(cash=900, seed=1)
        wealthy.buy(0, 1)
        self.assertIn("first_fleet", wealthy.milestones)
        self.assertEqual(wealthy.capacity, 25)
        self.assertEqual(Game.from_dict(wealthy.to_dict()).capacity, 25)

    def test_previous_save_version_loads(self):
        old = Game(seed=1).to_dict()
        old["version"] = 1
        for key in ("seed", "milestones", "event_history", "active_event", "event_count"):
            del old[key]
        restored = Game.from_dict(old)
        self.assertEqual(restored.cash, 500)
        self.assertEqual(restored.event_history, [])
        self.assertEqual(restored.to_dict()["version"], 4)

    def test_ship_appearance_is_cosmetic_validated_and_saved(self):
        game = Game(seed=1)
        before = (game.day, game.cash, game.capacity, game.cargo[:])
        style = {"hull": "lagoon", "sail": "sunset", "flag": "gold", "pattern": "stripe"}
        game.customize_ship(style)
        self.assertEqual(game.public_state()["ship_style"], style)
        self.assertEqual((game.day, game.cash, game.capacity, game.cargo), before)
        self.assertEqual(Game.from_dict(game.to_dict()).ship_style, style)
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "styled-voyage.json"
            game.save(path)
            self.assertEqual(Game.load(path).ship_style, style)
        with self.assertRaises(GameError):
            game.customize_ship({"hull": "unknown", "sail": "sunset", "flag": "gold", "pattern": "stripe"})
        self.assertEqual(game.ship_style, style)
        legacy = game.to_dict()
        legacy["version"] = 3
        del legacy["ship_style"]
        self.assertEqual(Game.from_dict(legacy).ship_style["hull"], "walnut")

    def test_contract_completion_reserves_space_and_pays_reward(self):
        game = Game(seed=1)
        offer = game.current_offer()
        self.assertEqual(offer, game.current_offer())
        game.accept_contract()
        self.assertEqual(game.cargo_used, offer["quantity"])
        with self.assertRaises(GameError):
            game.accept_contract()
        before = game.cash
        fare = game.transport_cost(offer["destination"])
        game.travel(offer["destination"])
        self.assertIsNone(game.active_contract)
        self.assertEqual(game.cash, before - fare + offer["reward"])
        self.assertEqual(game.contracts_completed, 1)
        self.assertEqual(game.cargo_used, 0)

    def test_contract_expiry_and_save_migration(self):
        game = Game(seed=1)
        offer = game.current_offer()
        game.accept_contract()
        restored = Game.from_dict(game.to_dict())
        self.assertEqual(restored.active_contract, offer)
        while game.day <= offer["deadline"]:
            game.wait()
        self.assertEqual(game.contracts_failed, 1)
        self.assertIsNone(game.active_contract)
        self.assertEqual(game.cargo_used, 0)
        old = Game(seed=1).to_dict()
        old["version"] = 2
        for key in ("active_contract", "contracts_completed", "contracts_failed"):
            del old[key]
        self.assertEqual(Game.from_dict(old).contracts_completed, 0)

    def test_atomic_save_replaces_existing_file(self):
        game = Game(seed=1)
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "voyage.json"
            path.write_text("obsolete", encoding="utf-8")
            game.save(path)
            self.assertEqual(Game.load(path).to_dict(), game.to_dict())
            self.assertFalse(path.with_name(path.name + ".tmp").exists())


if __name__ == "__main__":
    unittest.main()
