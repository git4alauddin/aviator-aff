import {config} from "./config.js";
import {playAccessSequence} from "./animations.js";

const root = document.documentElement;
document.querySelector('link[rel="canonical"]').href = new URL('/', config.siteUrl).href;
const preview = new URLSearchParams(window.location.search).get("preview") === "1";
const progressBar = document.querySelector('[role="progressbar"]');
const percent = document.querySelector("[data-progress-value]");
const progressLabel = document.querySelector("[data-progress-label]");
const redirectStatus = document.querySelector("[data-redirect-status]");
const announcement = document.querySelector("#sequence-announcement");
const steps = [...document.querySelectorAll("[data-console-step]")];
const tiles = [...document.querySelectorAll("[data-status-tile]")];
const stepThresholds = [0, 16, 35, 56, 77, 100];
const tileThresholds = [10, 35, 65, 100];
const tileCompleteLabels = ["LOADED", "ATTACHED", "READY", "OPEN"];
const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
let lastProgress = -1;
let lastStage = "";
let navigationFrame;
let fallbackTimer;

document.querySelectorAll("[data-wrapper-link]").forEach((link) => {
    link.href = config.registrationPage;
});
document.querySelectorAll('[data-creator-link]').forEach(link => {
    link.hidden = !config.creatorStudio.enabled;
    link.href = config.creatorStudio.url;
});
document.querySelector("[data-year]").textContent = new Date().getFullYear();
document.querySelector("#preview-notice").hidden = !preview;

function updateClock() {
    const now = new Date();
    const clock = document.querySelector("[data-clock]");
    clock.textContent = now.toLocaleTimeString("en-GB", {hour12: false});
    clock.dateTime = now.toISOString();
}

updateClock();
const clockTimer = window.setInterval(updateClock, 1000);

function render({progress, stage}) {
    if (progress !== lastProgress) {
        root.style.setProperty("--progress", `${progress}%`);
        root.style.setProperty("--progress-number", String(progress));
        progressBar.setAttribute("aria-valuenow", String(progress));
        percent.textContent = String(progress);
        // A takeoff arc follows loading progress; reduced motion keeps it static.
        const t = motionPreference.matches ? 1 : progress / 100;
        const x = 24 + 452 * t - 26 * t * t, y = 264 - 174 * t * t;
        const arc = `M24 264Q${24 + 226 * t} 264 ${x} ${y}`;
        document.getElementById('takeoffCurve').setAttribute('d', arc);
        document.getElementById('takeoffArea').setAttribute('d', `${arc}L${x} 264Z`);
        document.getElementById('takeoffPlane').setAttribute('x', x - 21);
        document.getElementById('takeoffPlane').setAttribute('y', y - 66.6);
        const currentStep = stepThresholds.findLastIndex((threshold) => progress >= threshold);
        steps.forEach((step, index) => {
            step.classList.toggle("is-visible", index <= currentStep);
            step.classList.toggle("is-current", index === currentStep);
            step.classList.toggle("is-done", index < currentStep || progress === 100);
        });
        const pendingTile = tileThresholds.findIndex((threshold) => progress < threshold);
        const activeTile = pendingTile === -1 ? tiles.length - 1 : pendingTile;
        tiles.forEach((tile, index) => {
            const complete = progress >= tileThresholds[index];
            tile.classList.toggle("is-complete", complete);
            tile.classList.toggle("is-active", index === activeTile);
            const label = index === 3 ? "BOARDING" : complete ? tileCompleteLabels[index] : index === 0 ? "LOADING" : "STANDBY";
            tile.querySelector("[data-tile-label]").textContent = label;
        });
        lastProgress = progress;
    }
    if (stage !== lastStage) {
        root.dataset.stage = stage;
        const complete = stage !== "locked";
        const opening = stage === "unlocking" || stage === "unlocked";
        document.querySelector("[data-session-status]").textContent = complete ? "READY" : "PREPARING";
        document.querySelector("[data-lock-caption]").textContent = opening ? "READY FOR TAKEOFF" : complete ? "FLIGHT READY" : "PREPARING FLIGHT";
        document.querySelector("[data-access-status]").textContent = opening ? "OPEN" : complete ? "READY" : "PREPARING";
        document.querySelector("[data-node-status]").textContent = opening ? "REGISTRATION LINK READY" : "REGISTRATION ROUTE";
        progressLabel.textContent = opening ? "Ready for takeoff" : complete ? "Flight prepared" : "Preparing your flight";
        if (opening) {
            tiles[3].querySelector("[data-tile-label]").textContent = "OPEN";
            redirectStatus.textContent = preview ? "Preview complete — automatic navigation paused" : "Opening DmFirst registration…";
            announcement.textContent = preview ? "Flight preview complete. Registration is available below." : "Flight preparation complete. Opening the registration page.";
        }
        lastStage = stage;
    }
}

function complete() {
    root.dataset.finished = "true";
    window.clearInterval(clockTimer);
    if (preview) {
        document.querySelector("#wrapper-preview-link").hidden = false;
        return;
    }
    // Paint the completed takeoff before navigating to the registration wrapper.
    navigationFrame = requestAnimationFrame(() => {
        navigationFrame = requestAnimationFrame(() => {
            try {
                window.location.replace(config.registrationPage);
            } catch {
                document.querySelector("#redirect-fallback").hidden = false;
            }
            fallbackTimer = window.setTimeout(() => {
                document.querySelector("#redirect-fallback").hidden = false;
            }, 1800);
        });
    });
}

const stopSequence = playAccessSequence({timing: config.sequence, onUpdate: render, onComplete: complete});

window.addEventListener("pagehide", () => {
    stopSequence();
    window.clearInterval(clockTimer);
    cancelAnimationFrame(navigationFrame);
    window.clearTimeout(fallbackTimer);
}, {once: true});

window.addEventListener("pageshow", (event) => {
    if (event.persisted) window.location.reload();
});
