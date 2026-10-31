# Island Trade Tycoon

A 30-day, single-player island trading strategy game. The **main program is Python** and uses only the Python standard library. The optional local browser interface calls the same Python game engine; it does not implement separate game rules.

## Run

Requires Python **3.10 or newer**. No `pip` installation is needed.

**On macOS, double-click `START_MAP_MAC.command`** to open the ship builder with Map View selected. `START_WEB_MAC.command` opens the same builder with Harbor View selected. Keep the Terminal window open while playing. Do not open either HTML file directly; both interfaces need the local Python server.

```bash
python3 main.py
```

For the new interactive map:

```bash
python3 main.py --web --shipyard --map --open
```

For the original animated harbor:

```bash
python3 main.py --web --shipyard --open
```

The browser should open automatically. If it does not, copy the address printed in the terminal (normally `http://127.0.0.1:8765`; a free port is chosen if that one is busy). Use `--port 9000` to request another port. Stop with Ctrl+C. The server binds to localhost only and needs no Internet connection.

## Repository layout

Use **this deliverables folder** as the repository root when uploading to GitHub. The source files are grouped by responsibility:

| Folder or file | Purpose |
| --- | --- |
| `main.py` | One entry point for the CLI and local web server |
| `island_trade/` | Python game engine: rules, events, contracts, route advice, ship options, saves, HTTP adapter |
| `web/` | Harbor page, shipyard, shared ship visuals, and `map/` sea-chart page |
| `tests/` | Python unit tests |
| `poster/` | Original and updated pixel-art posters; one-page Word showcase with poster and introduction |
| `docs/` | [Architecture and module guide](docs/ARCHITECTURE.md) and [Padlet copy](docs/PADLET_POST.md) |
| `START_MAP_MAC.command`, `START_WEB_MAC.command` | macOS launchers that open the shipyard before the selected view |
| `.gitignore` | Keeps local saves, caches, editor files, and the legacy map alias out of Git |

`savegame.json` is a local personal save and is not included in a Git upload. The local `web_map` compatibility link exists only for an older running server; maintained map files are in `web/map/`. Course lecture PDFs and process records are outside this deliverables folder.

## How to play

- Before a new voyage, customize the ship’s hull, sail, flag and sail mark in the shipyard. The live preview shows the result. Choose Map View or Harbor View, then begin; the same appearance follows the ship between views and into saved games. You can also apply a new appearance to the current voyage without changing its progress.
- Begin with 500 coins and 20 cargo slots at Coral Bay.
- Buy four goods where supply is high; sell where supply is scarce. A 2-coin handling fee applies to every unit bought. Buying reduces local stock and raises later prices; selling does the reverse.
- Sail among five islands. Travel takes 1–3 days and costs `14 × days + 1 × occupied cargo slots` coins, before any temporary event adjustment.
- Ask the **Captain's Navigator** for a projected opening trade when your ship is empty, or a sale route for cargo you already carry. It searches up to two sailing legs, checks time and cash, and compares selling across ports. Projections use today's prices and known travel effects; future random events are not predicted.
- Upgrade cargo capacity by 10 slots. The first upgrade costs 180 coins; later upgrades cost 120 more each.
- Use **Wait** to advance a day. Each market recovers one stock unit per good toward its normal level each day.
- Daily random events may change one island's supply or temporarily alter sailing costs and buying fees. Each new game gets a random seed; the seed is stored with the save so loading cannot reroll an event.
- Each port offers a deterministic, time-limited **delivery contract**. Accepting loads 3–7 sealed crates at no purchase cost; they occupy cargo slots and add to sailing costs. Arrive at the named destination by the stated day to receive the listed reward. An expired delivery pays nothing and frees the slots. Only one contract can be active at a time.
- The browser's pixel-art harbor shows the ship, crew, merchant, island goods, and moving sea. Use the **Captain's Desk** beside the scene to buy, sell, accept a delivery, wait, or sail. Cargo moves during trades; sailing switches to an animated sea passage. The detailed market and log remain below the scene.
- The new sea chart draws five original pixel islands. Drag the ship onto an island to sail directly, or select an island and use **Set sail**. Milestones and contracts collapse on the left; dockside trading collapses on the right. On narrow screens the chart scrolls horizontally inside the page, with panels below it. Market, routes, cargo, and log are available in tabs. Both browser views use the same Python server and voyage.
- The browser adapts to narrow screens and labels trade controls for assistive technology. Use **Skip to game** from the keyboard to reach the main content. **Pause Animation** freezes the moving harbor; the system's reduced-motion preference also stops animation.
- Milestones unlock automatically: **5 trades** lowers the buying fee by 1 coin, **800 total assets** grants 5 cargo slots, and **12 trades** grants 100 coins once. The browser interface shows progress.
- After day 30, review cash, remaining cargo value, total assets, trades, completed/expired deliveries, and upgrades. You may start again.
- Save and load with `savegame.json` in this folder. It is created only when Save is used. Saving replaces the previous file atomically; version 1, 2 and 3 saves can still be loaded. Current saves use version 4 and include ship appearance.

The CLI commands are `buy`, `sell`, `sail`, `wait`, `upgrade`, `contract`, `advice`, `save`, `load`, `status`, and `quit`. Enter numbered goods/islands when prompted.

## Assessment notes

The advanced Python topics are **file I/O** (validated JSON save/load), **multi-dimensional lists** (5×4 market stocks and prices, 5×5 route matrix), **recursion** (bounded route search), **object-oriented design** (`Game` dataclass with focused rule classes), and **error handling** (`GameError`). Comments in the code are in English as required by the marking guideline. `main.py` remains the sole program entry point; the browser and CLI call the same `Game` object.

The Ed submission requires all Python code files. A browser UI must be disclosed to the tutor because Ed's execution environment may not run web applications. The CLI is the primary assessor-friendly path. Ship appearance is a browser feature and does not affect CLI game rules. The Padlet post and in-class presentation must be completed by the student.

Run checks:

```bash
python3 -m unittest discover -s tests -v
```

This project is original student work. Its design was informed by publicly documented trading-game patterns, including [Endless Sky](https://github.com/endless-sky/endless-sky) and [OpenTTD](https://github.com/OpenTTD/OpenTTD); no external code or art assets were copied. The original poster background and updated pixel-art poster were AI-generated for this project; the original poster's text was laid out locally. See the process documents for references and scope decisions.
