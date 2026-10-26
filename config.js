// Visitor prediction settings. Creator Studio uses studio-config.js.
globalThis.SIM_CONFIG = {
  crashPoints: [1.24, 2.56, 5.80, 1.08, 3.42, 8.17, 1.61, 2.09],
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
      terminalLabel: 'FLIGHT DECK',
      entryTitle: 'Enter access code',
      entryHelp: 'Enter your code to open the Aviator prediction.',
      unlockButton: 'Unlock',
      predictButton: 'Predict',
      predictAgainButton: 'Predict again',
      resultLabel: 'Preset crash multiplier',
    },
  },
  // All outcomes are predetermined: this is a demonstration, not a prediction engine.
};
