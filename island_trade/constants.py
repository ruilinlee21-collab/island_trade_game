"""Shared game data and balancing values."""

GOODS = ("Fish", "Coconuts", "Wood", "Spices")
BASE_PRICE = (18, 26, 42, 65)
ISLANDS = ("Coral Bay", "Palm Haven", "Timber Point", "Spice Cove", "Harbor City")
BASE_STOCK = ((42, 28, 18, 9), (25, 50, 16, 12), (18, 22, 48, 9), (20, 26, 17, 40), (32, 30, 27, 20))
# A two-dimensional route table: each entry is days of travel, 0 on the diagonal.
DISTANCES = ((0, 1, 2, 3, 2), (1, 0, 2, 2, 3), (2, 2, 0, 2, 1), (3, 2, 2, 0, 2), (2, 3, 1, 2, 0))
MAX_DAYS = 30
TRAVEL_DAY_COST = 14
CARGO_SLOT_COST = 1
SAVE_VERSION = 4
EVENT_CHANCE = 0.45
EVENT_KINDS = ("fish_glut", "spice_festival", "timber_delivery",
               "coconut_festival", "fair_winds", "storm", "merchant_fair")
