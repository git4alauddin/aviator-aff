globalThis.SIM_CONFIG = {
  crashPoints: [1.24, 2.56, 5.80, 1.08, 3.42, 8.17, 1.61, 2.09],
  countdownSeconds: 4,
  postCrashSeconds: 2.5,
  growthRate: 0.075,
  // Flight appearance is independent of the preset crash multiplier.
  flight: {
    climbSeconds: 8,            // Verified public demo: initial climb
    glideSeconds: 4,            // Downward glide, then the same duration back up
    marginLeft: 21,             // Screen pixels, independent of arena size
    marginBottom: 7,
    lineWidth: 4,
    color: '#f00b3e',
    fillOpacity: 0.5,
    planeScale: 1,              // 150 x 74 reference size; adapts down to 65%
    propellerFps: 7.5,          // Original four-frame SVG animation cadence
    flyAwaySeconds: 0.5,
  },
  currency: 'USD',              // Display unit for virtual credits only
  initialCredits: 29999,
  initialHistory: [2.19, 1.87, 1.08, 1.20, 3.44, 2.93, 1.18, 1.27, 2.61, 1.30, 2.12, 1.26, 1.74, 1.04, 1.18, 1.00, 1.00, 1.02, 1.60, 1.76, 1.30, 5.99, 1.04, 1.03, 3.34, 1.18, 2.34, 1.42, 4.23, 1.08],
  maxDisplayedHistory: 30,
  studio: {
    accessCode: '@creator',    // Simple public browser-side entry gate.
  },
  // Selected public settings adapted from dmfirst-affiliation/js/prediction-config.js.
  prediction: {
    enabled: true,
    accessCode: 'avfirst',      // Public browser-side gate, not secure authentication.
    brand: 'DM FIRST',
    gameName: 'Aviator',
    unlockDurationMs: 1800,
    unlockHoldMs: 300,
    revealDurationMs: 720,
    adminContact: { telegramUsername: '', text: '@mr_kalam0', url: '' },
    text: {
      widgetLabel: 'PREDICT',
      terminalLabel: 'FLIGHT TERMINAL',
      entryTitle: 'Enter access code',
      entryHelp: 'Enter your code to open the Aviator preview.',
      unlockButton: 'Unlock',
      predictButton: 'Predict',
      predictAgainButton: 'Predict again',
      resultLabel: 'Preset crash multiplier',
    },
  },
  // All outcomes are predetermined: this is a demonstration, not a prediction engine.
};
