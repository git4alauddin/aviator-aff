// Creator Studio only. Reload the Studio after changing these settings.
// The visitor prediction popup uses config.js instead.
globalThis.SIM_CONFIG = {
  crashPoints: [1.24, 2.56, 5.80, 1.08, 3.42, 8.17, 1.61, 2.09],
  countdownSeconds: 4,
  postCrashSeconds: 2.5,
  growthRate: 0.075,
  // Flight appearance is independent of the preset crash multiplier.
  flight: {
    climbSeconds: 8,
    glideSeconds: 4,
    marginLeft: 21,
    marginBottom: 7,
    lineWidth: 4,
    color: '#f00b3e',
    fillOpacity: 0.5,
    planeScale: 1,
    propellerFps: 7.5,
    flyAwaySeconds: 0.5,
  },
  currency: 'INR',              // Display unit for virtual credits only.
  locale: 'en-IN',              // Indian digit grouping: 1,00,000.00.
  initialCredits: 29999,
  betting: {
    defaultStake: 10,
    minStake: 10,
    maxStake: 100000,
    step: 10,                   // Amount added/subtracted by the +/- buttons.
    presets: [10, 100, 500, 1000],
  },
  initialHistory: [2.19, 1.87, 1.08, 1.20, 3.44, 2.93, 1.18, 1.27, 2.61, 1.30, 2.12, 1.26, 1.74, 1.04, 1.18, 1.00, 1.00, 1.02, 1.60, 1.76, 1.30, 5.99, 1.04, 1.03, 3.34, 1.18, 2.34, 1.42, 4.23, 1.08],
  maxDisplayedHistory: 30,
  // Synthetic player activity; amounts use the display currency above.
  activity: {
    players: {min: 120, max: 210},   // Bets per round; join during the countdown.
    stakes: {min: 10, max: 25000},
    spectators: {min: 90, max: 260},
    returningShare: 0.65,           // Returning identities from the last round.
    refreshMs: 200,
  },
  studio: {
    accessCode: '@creator',     // Existing browser-side entry gate.
  },
  // The golden bar above the flight area.
  disclaimer: {
    enabled: false,              // false hides the bar.
    text: 'CREATOR STUDIO · SIMULATION',
    tooltip: 'Creator recording with virtual credits and predetermined outcomes',
  },
  // Studio prediction opens directly after entering the Studio.
  prediction: {
    enabled: true,
    brand: 'DM FIRST',
    gameName: 'Aviator',
    revealDurationMs: 720,
    text: {
      widgetLabel: 'PREDICT',
      terminalLabel: 'FLIGHT DECK',
      predictButton: 'Predict',
      predictAgainButton: 'Predict again',
      resultLabel: 'Preset crash multiplier',
    },
  },
  // All outcomes are predetermined; these settings do not use live game data.
};
