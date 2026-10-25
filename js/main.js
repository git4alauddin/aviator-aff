import {config} from "./config.js";
import {playAccessSequence, startCodeRain} from "./animations.js";

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
let finished = false;
let stopRain = () => {
};
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

function updateMotion() {
    stopRain(true);
    if (!motionPreference.matches && !finished) stopRain = startCodeRain(document.querySelector("#code-rain"));
}

updateMotion();
motionPreference.addEventListener("change", updateMotion);

function render({progress, stage}) {
    if (progress !== lastProgress) {
        root.style.setProperty("--progress", `${progress}%`);
        root.style.setProperty("--progress-number", String(progress));
        progressBar.setAttribute("aria-valuenow", String(progress));
        percent.textContent = String(progress);
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
            const label = index === 3 ? "LOCKED" : complete ? tileCompleteLabels[index] : index === 0 ? "LOADING" : "STANDBY";
            tile.querySelector("[data-tile-label]").textContent = label;
        });
        lastProgress = progress;
    }
    if (stage !== lastStage) {
        root.dataset.stage = stage;
        const complete = stage !== "locked";
        const opening = stage === "unlocking" || stage === "unlocked";
        document.querySelector("[data-session-status]").textContent = complete ? "READY" : "PREPARING";
        document.querySelector("[data-lock-caption]").textContent = opening ? "ACCESS OPEN" : complete ? "LINK READY" : "STANDBY";
        document.querySelector("[data-access-status]").textContent = opening ? "OPEN" : complete ? "READY" : "PREPARING";
        document.querySelector("[data-node-status]").textContent = opening ? "REGISTRATION LINK READY" : "REGISTRATION ROUTE";
        progressLabel.textContent = opening ? "ACCESS OPEN — LET’S GO" : complete ? "REFERRAL LINK READY" : "PREPARING YOUR ACCESS";
        if (opening) {
            tiles[3].querySelector("[data-tile-label]").textContent = "OPEN";
            redirectStatus.textContent = preview ? "Preview complete — automatic navigation paused" : "Opening DmFirst registration…";
            announcement.textContent = preview ? "Preview: lock opened. Registration preview is available below." : "Access sequence complete. Opening the registration page.";
        }
        lastStage = stage;
    }
}

function complete() {
    finished = true;
    root.dataset.finished = "true";
    stopRain();
    window.clearInterval(clockTimer);
    if (preview) {
        document.querySelector("#wrapper-preview-link").hidden = false;
        return;
    }
    // Paint the completed unlock before navigating to our local wrapper.
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
    stopRain();
    window.clearInterval(clockTimer);
    cancelAnimationFrame(navigationFrame);
    window.clearTimeout(fallbackTimer);
    motionPreference.removeEventListener("change", updateMotion);
}, {once: true});

window.addEventListener("pageshow", (event) => {
    if (event.persisted) window.location.reload();
});
