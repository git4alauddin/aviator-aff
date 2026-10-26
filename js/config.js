import "../config.js";

// Public destinations only. Never place credentials in client-side files.
export const config = Object.freeze({
    siteUrl: "https://aviator.kalam.trade",
    creatorStudio: Object.freeze({enabled: true, url: "./creator-studio.html"}),
    guidance: Object.freeze({enabled: true, src: "./assets/audio/aviator_guide.mp3"}),
    registerUrl:
        "https://www.dmfirst0.com/#/register?invitationCode=93458117528",
    registrationPage: "./registration.html",
    depositUrl: "https://www.dmfirst0.com/#/wallet/Recharge",
    popupDelayMs: 1000,
    activityIntervalMs: 4000,
    minimumDeposit: 1000,
    depositCurrency: "INR",
    copyCodeDemo: Object.freeze({
        heading: "Already deposited?",
        //caption: "Simulation only",
        buttonText: "Copy Code",
        loadingText: "Copying…",
        completeText: "Complete",
    }),
    sequence: Object.freeze({
        fillMs: 1800,
        holdMs: 300,
        unlockMs: 0,
    }),
});
