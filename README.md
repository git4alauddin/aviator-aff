# DM FIRST × Aviator

DM FIRST portal adapted for `aviator.kalam.trade`: landing animation, registration
and wallet wrapper, deposit details, draggable widgets, configurable voice, and
an Aviator preset preview. Creator Studio opens the existing flight simulation.

The loading page uses the Aviator terminal theme in `css/aviator-terminal.css`:
dark panels, red flight visuals, mint console text, a segmented glowing loader,
typed initialization lines, scanning sweeps, title glitches, moving code columns,
and a hooded silhouette behind the flight display. The progress bar, connection
details, clock, preparation checklist, flight status, four status cards, Creator
Studio navigation, preview mode, and DM FIRST partnership remain available.
These are visual interface effects; the page prepares the configured referral.
Loading still redirects directly to registration with the same timing. Preview
mode holds the completed portal; reduced motion keeps the plane static.

The registration wrapper, wallet popup, floating controls, prediction panel, and
Creator Studio entry retain the red Aviator theme in `css/aviator-theme.css`.
DM FIRST remains the registration/wallet partner; the embedded site keeps its
own interface.

## Preview

Node.js 20+ is required. No dependencies need installing.

```powershell
npm start
```

- `http://127.0.0.1:4173/` — landing, then registration.
- `http://127.0.0.1:4173/?preview=1` — landing without automatic navigation.
- `http://127.0.0.1:4173/registration.html` — registration, deposit details, PREDICT.
- `http://127.0.0.1:4173/creator-studio.html` — creator recording simulation.

Use the server for visitor pages, which use JavaScript modules. Creator Studio
also works by opening its HTML file directly.

## Flow and settings

The landing opens the registration wrapper. Deposit details appear after the
configured delay. Claim opens wallet recharge in the iframe. The top-right area
contains only Creator Studio. Reopening details through the floating widget after Claim
shows a Copy Code button simulation. It animates loading and completion feedback
without reading or writing the clipboard or displaying the access password.
A Claim click does not verify a deposit or registration.

The prediction reveal uses a scanning sweep and a subtle plane/trail behind the
multiplier. Both follow the same 720ms reveal clock and stop on completion, close,
or a round change. Reduced motion skips these effects and reveals immediately.

PREDICT asks for the configured code, then previews local
Aviator presets. Visitor results cycle through presets and never read the external
iframe or live game. Creator Studio requires its separate entry password from
`SIM_CONFIG.studio.accessCode`, then opens its prediction panel directly and
follows its own simulation rounds. This is a simple browser-side entry gate.
Visitor access still requires its own code. Activity
is visibly labeled fictional sample data. The golden Studio disclaimer bar is
enabled by default and configured in `studio-config.js`.

- `js/config.js`: referral/wallet URLs, deposit amount/currency, promotional and
  landing timing, activity interval, Creator Studio link, site URL, voice settings.
  The reference's URLs and ₹1,000 configured minimum are retained.
- `config.js`: visitor prediction presets, access code, labels, contact, and timing.
  The copy simulation does not use or display the access code.
- `studio-config.js`: Studio presets, countdown/crash timing, multiplier growth,
  flight appearance, starting balance, currency, history, existing Studio password,
  disclaimer bar, and Studio prediction settings. Studio loads only this file;
  its settings are independent of the visitor popup.

For the golden bar, change `disclaimer.enabled` to show/hide it, `disclaimer.text`
for its message, and `disclaimer.tooltip` for its hover description. Set
`prediction.enabled` to show/hide Studio PREDICT and `prediction.revealDurationMs`
for the scan duration. Reload Studio after editing. Its entry password stays
`@creator`; prediction inside Studio still opens directly without another password.
The Studio PREDICT button starts at the flight area's upper right. Drag it with
mouse or touch to reposition it within that area; a click or tap opens prediction.

Voice is enabled using `assets/audio/aviator_guide.mp3`.
Change `guidance.src` in `js/config.js` for another filename, or set
`guidance.enabled: false` to disable it. Close or Claim starts
guidance from the user's click; play, stop, replay, blocked playback, and missing
audio feedback are supported. The old WinGo recording is excluded.

Config files are public assets. The code is a UI gate, not secure authentication.
All predictions and credits here are simulation data.

## Build and hosting

```powershell
npm run check
npm test
npm run test:ui
npm run build
```

`dist/` contains public pages, scripts, styles, and assets, including Creator
Studio. Tests, repository metadata, references, screenshots, and tools stay out.
`wrangler.jsonc` prepares a Cloudflare static-assets project named
`aviator-kalam-trade`. Building does not publish or change DNS. Assign
`aviator.kalam.trade` when setting up the deployed host.

Browser checks run an isolated Chrome/Edge profile and a temporary server, then
close both. They verify landing handoff, deposit/code flow, Aviator previews,
Creator Studio navigation, mobile layouts, private-file blocking, and existing
flight/betting behavior. External DM FIRST requests are blocked in these checks;
external embedding and account actions are not verified. Screenshots are in
`preview/site-*.png`.

## Reference

Portal, deposit, activity, audio, and dragging behavior are adapted from
[git4alauddin/dmfirst-affiliation](https://github.com/git4alauddin/dmfirst-affiliation).
The source tree inspected on 2026-10-25 was
`68514cfa8c989ce03f80c7587417c103dd2ee1ff`. WinGo reels, number artwork, and old
audio are excluded; our Aviator panel replaces the reels.

Flight details remain in `reference/README.md`, `reference/plane-assets.json`, and
`reference/simulation.md`.
