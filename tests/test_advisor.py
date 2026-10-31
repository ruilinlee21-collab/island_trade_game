"""Route advice covers useful, deadline, affordability, and purity cases."""

import unittest

from island_trade.advisor import recommend_sale_route
from island_trade.game import Game


class AdvisorTests(unittest.TestCase):
    def test_recommends_profitable_sale_without_mutation(self):
        game = Game(cargo=[0, 0, 0, 4], location=3, cash=300, seed=1)
        before = game.to_dict()
        plan = recommend_sale_route(game)
        self.assertEqual(plan["route"], ["Spice Cove", "Timber Point"])
        self.assertEqual(plan["advantage"], 56)
        self.assertEqual(plan["estimated_net"], plan["estimated_sales"] - plan["estimated_transport"])
        self.assertEqual(game.to_dict(), before)

    def test_empty_ship_receives_feasible_first_trade(self):
        opening = recommend_sale_route(Game(seed=1))
        self.assertEqual(opening["route"], ["Coral Bay", "Timber Point", "Palm Haven"])
        self.assertGreater(opening["estimated_net"], 0)
        self.assertEqual(opening["estimated_sales"] - opening["estimated_buy_cost"]
                         - opening["estimated_transport"], opening["estimated_net"])

    def test_no_time_returns_no_sailing(self):
        self.assertEqual(recommend_sale_route(Game(day=30, seed=1))["route"], [])
        final_day = Game(cargo=[0, 0, 0, 4], location=3, day=30, seed=1)
        self.assertEqual(recommend_sale_route(final_day)["route"], ["Spice Cove"])
        self.assertEqual(recommend_sale_route(final_day)["travel_days"], 0)

    def test_affordability_and_weather_affect_plan(self):
        poor = Game(cargo=[2, 0, 0, 0], cash=0, seed=1)
        self.assertEqual(recommend_sale_route(poor)["route"], ["Coral Bay"])
        storm = Game(cargo=[0, 0, 0, 4], location=3, day=2, cash=300, seed=1,
                     active_event={"kind": "storm", "until": 4})
        fair = Game(cargo=[0, 0, 0, 4], location=3, day=2, cash=300, seed=1,
                    active_event={"kind": "fair_winds", "until": 4})
        self.assertGreater(recommend_sale_route(fair)["advantage"],
                           recommend_sale_route(storm)["advantage"])


if __name__ == "__main__":
    unittest.main()
