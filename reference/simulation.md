# Aviator — Flight Simulation

A local visual demo calibrated against the supplied desktop screenshot and the official public client's animation definitions. All credits, players, bets, and payouts are illustrative; crash outcomes follow the sequence in config.js. See reference/README.md for the source, version, and verified behavior.

## Run

Open index.html in Chrome, Edge, Firefox, or Safari. No server, installation, or network connection is needed; the plane frames are bundled locally.

## Interface

- Full-height desktop layout, player sidebar, multiplier history, gold FUN MODE banner, radial flight arena, and two bet panels.
- The official demo's four original plane SVG frames, played in their original order at 7.5 frames per second. The original fuselage, wings, cockpit, tail, color, and blade poses are preserved, with the reference anchor at 14% across and 90% down the sprite. Frame loading is preloaded to avoid flicker. The propeller continues through countdown, takeoff, and fly-away; Pause and reduced-motion preferences are respected.
- An eight-second climb leads into a repeating glide: four seconds down and four seconds back up. The complete quadratic curve reshapes with the plane, matching the public client. The plane's orientation stays fixed during the glide.
- Background rays rotate around the takeoff point once every 36 seconds. The glow is blue below 2x, purple from 2x, and magenta from 10x, with half-second color blends. The effect follows Pause / Resume and respects reduced-motion preferences.
- At the round's end, the curve clears immediately, the plane flies out over half a second, and the glow fades over one second.
- Responsive mobile layout with the flight area and both controls above the player list.
- Virtual stake placement and cancellation during countdown; manual cash out during flight.
- Green cash-out confirmations show the settled multiplier and payout, with decorative stars, a close button, and automatic dismissal after five seconds. Both panels can show a confirmation at once.
- Cash-out payouts use the displayed multiplier and stay fixed when the next stake is edited.
- Bets placed during flight are queued for the next round and can be cancelled.
- Placed and queued stakes are locked until settlement or cancellation.
- Auto mode exposes automatic bet placement and an optional cash-out multiplier.
- All Bets, Previous, and Top show illustrative results; the history button opens previous multipliers.
- The top-right menu contains Pause / Resume and Next round. Skipping refunds unsettled stakes.
- PREDICT opens the DM FIRST style code prompt, with checking progress, retry feedback, and optional admin contact. After unlocking, it reveals the selected demo round's configured crash multiplier. Results clear when their round ends or is skipped.

## Files

| File | Purpose |
| --- | --- |
| index.html | Page structure and accessible controls |
| styles.css | Desktop and mobile layouts |
| app.js | Round state, virtual balances, controls, history, and sample players |
| flight.js | Original-frame aircraft animation and time-based curve renderer |
| prediction.js / prediction.css | Code entry and round-aware Aviator preset preview |
| assets/plane/ | Four original plane SVG frames from the official public demo |
| config.js | Predetermined results, timing, virtual starting balance, and drawing options |

The display unit defaults to USD to match the reference; it labels virtual credits. The starting balance is 29,999.00. Changing these values never connects the demo to real payments.

## Prediction preview configuration

The code-entry interaction is adapted from [dmfirst-affiliation](https://github.com/git4alauddin/dmfirst-affiliation), specifically `js/prediction-widget.js` and `js/prediction-config.js`. Its WinGo number/size/color results are replaced with an Aviator multiplier. Only the selected public settings are copied into `SIM_CONFIG.prediction` in this project's `config.js`; there is no runtime dependency on GitHub or the affiliate registration/deposit pages.

- `enabled`: show or hide PREDICT.
- `accessCode`: defaults to `DMFIRST`; matching is case-sensitive and trims surrounding spaces. An empty code disables unlocking. This is a public browser-side UI gate, not secure authentication; keep secrets out of config.js.
- `brand`, `gameName`, and `text`: selected labels for the launcher, code prompt, buttons, and result caption; omitted text fields retain defaults.
- `adminContact`: `telegramUsername`, fallback `text`, and optional `url`. A username becomes a Telegram link; supported contact URLs use HTTPS, mailto, or tel.
- `unlockDurationMs`, `unlockHoldMs`, `revealDurationMs`: checking progress, the hold at 100%, and multiplier reveal timing. Reduced motion skips cycling digits.

The result comes from `crashPoints`, using the same round index as the flight. During countdown or flight it previews that round; after a crash it previews the next round. Predicting again returns the same preset for the same round. The game passes only the round ID, phase, and target into the widget. A round change cancels an unfinished reveal and clears stale results, including when the sequence loops. This feature reveals known simulation data; it does not forecast real Aviator outcomes or connect to a live game.

## Flight configuration

The flight object in config.js controls climbSeconds, glideSeconds, marginLeft, marginBottom, lineWidth, color, fillOpacity, planeScale, propellerFps, and flyAwaySeconds. The color setting controls the curve; the original plane art retains its source color. Margins are screen pixels. Geometry uses a 1000 × 500 SVG viewBox; the renderer converts the public client's pixel-based motion into these coordinates. The nominal aircraft is 150 × 74 pixels and scales with arena width, down to 65%.

Flight timing is independent of the preset crash result. The curve is a single quadratic arc from the lower left to the current aircraft position, with its control point at half the endpoint's horizontal coordinate and the bottom of the arena. It is redrawn during the glide rather than recording historical positions. The multiplier grows exponentially at growthRate and stops at the next configured crashPoints value. These local preset outcomes remain demonstration settings.

## Verification

Run node verify-ui.cjs on Windows with Chrome or Edge installed. This uses an isolated headless browser profile and Node's built-in APIs; no packages are required. It checks motion against independently calculated reference positions for desktop and mobile, smooth glide reversals, the reshaping quadratic curve, color thresholds and blends, ray timing, painted-aircraft bounds, and fly-away behavior. It also checks the existing virtual balances, notifications, controls, pause behavior, and responsive layouts. Screenshots in preview include desktop/mobile views plus climb.png, descent.png, recovery.png, and high-multiplier.png.

The logo and avatars use local fonts and original SVG illustrations. They approximate the supplied reference rather than embedding its screenshot.

The aircraft frames are the original SPRIBE public-demo assets. Their source URLs, dimensions, animation cadence, and SHA-256 hashes are recorded in reference/plane-assets.json. The browser check verifies their hashes, decoding, frame sequence, timing, geometry, and visibility. Run node verify-ui.cjs --plane-reference to refresh preview/plane-frames.png from the four-frame reference sheet.
