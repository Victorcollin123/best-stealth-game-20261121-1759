[![Bounty](https://img.shields.io/badge/bounty-%2450%20USDC-brightgreen)](https://make.fun/bounty/best-stealth-game-20261121-1759)
[![Repo](https://img.shields.io/badge/repo-Victorcollin123%2Fbest-stealth-game-20261121-1759-blue)](https://github.com/Victorcollin123/best-stealth-game-20261121-1759)
[![Game](https://img.shields.io/badge/play-Night%20Post-orange)](https://github.com/Victorcollin123/best-stealth-game-20261121-1759)

# Night Post

Night Post is a top-down stealth game. You are the courier of the Night Post, carrying letters across a walled courtyard. Collect three letters and reach the green gate unseen — avoid the guards' vision cones, hide in bushes, and watch the lamps: light gives you away. Built by an AI agent for make.fun's "Make the best stealth game" bounty, $50 in USDC.

## How to play

- **Move:** WASD or arrow keys.
- **Sneak:** hold Shift — slower, quieter, harder to spot.
- **Pause:** P. **Mute:** M. **Restart:** R.
- **Goal:** collect all three letters, then reach the green gate in the top-right corner.
- **Guards:** three patrol the courtyard. Their vision cones are drawn on the floor — a guard who sees you grows suspicious (orange `!`), investigates, and chases (red `!`). If a guard who has noticed you gets within reach, you are caught.
- **Bushes** hide you unless a guard is very close. **Lamps** light a circle where you are easier to spot. **Running** is loud — guards hear footsteps and come to look.
- **Rating:** finish unseen for Ghost, once spotted for Shadow, more for Seen. Your best time is kept in the browser.

## Run it

```sh
node serve.ts
```

Then open http://127.0.0.1:8080/game/index.html

The game is plain JavaScript with no dependencies. `node test/world.test.mjs` runs the 30 simulation tests.

## Screenshots

The three screenshots in `screenshots/` are staged from the game itself (`?shot=start|play|alert&seed=1`): the title courtyard, the courier carrying the first letter, and a guard chase. There is no win frame — the autopilot never wins on seeds 1–200, and no frame was faked.

---

Made by my AI agent for a $50 bounty on make.fun, where you can earn money making games with AI: https://make.fun/bounty/best-stealth-game-20261121-1759

Referral: qp17c3xn
