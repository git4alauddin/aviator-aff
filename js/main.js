import {config} from "./config.js";
import {playAccessSequence} from "./animations.js";

const root = document.documentElement;
document.querySelector('link[rel="canonical"]').href = new URL('/', config.siteUrl).href;
const preview = new URLSearchParams(window.location.search).get("preview") === "1";
root.dataset.preview = String(preview);
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
    const plane = document.getElementById('takeoffPlane');
    const frame = motionPreference.matches ? 0 : Math.floor(performance.now() * 7.5 / 1000) % 4;
    plane.setAttribute('href', `./assets/plane/plane-${frame}.svg`);
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
        plane.setAttribute('x', x - Number(plane.getAttribute('width')) * .14);
        plane.setAttribute('y', y - Number(plane.getAttribute('height')) * .9);
        document.getElementById('launchClearance').textContent = progress < 35 ? 'PRE-FLIGHT' : progress < 77 ? 'ON THE RUNWAY' : progress < 100 ? 'FINAL CHECK' : 'CLEARED';
        const currentStep = stepThresholds.findLastIndex((threshold) => progress >= threshold);
        document.querySelector('[data-diagnostic]').textContent = `0x${(progress * 631).toString(16).padStart(4, '0').toUpperCase()} // AV.UI`;
        steps.forEach((step, index) => {
            step.classList.toggle("is-visible", index <= currentStep);
            step.classList.toggle("is-current", index === currentStep);
            step.classList.toggle("is-done", index < currentStep || progress === 100);
            const copy = step.querySelector('[data-console-copy]');
            const line = copy.dataset.line;
            const span = (stepThresholds[index + 1] ?? 101) - stepThresholds[index];
            const reveal = motionPreference.matches || index !== currentStep || progress === 100 ? 1 : Math.min(1, (progress - stepThresholds[index] + 3) / span);
            copy.textContent = line.slice(0, Math.ceil(line.length * reveal));
        });
        const pendingTile = tileThresholds.findIndex((threshold) => progress < threshold);
        const activeTile = pendingTile === -1 ? tiles.length - 1 : pendingTile;
        tiles.forEach((tile, index) => {
            const complete = progress >= tileThresholds[index];
            tile.classList.toggle("is-complete", complete);
            tile.classList.toggle("is-active", index === activeTile);
            const label = complete ? tileCompleteLabels[index] : index === 3 ? "LOCKED" : index === 0 ? "LOADING" : "STANDBY";
            tile.querySelector("[data-tile-label]").textContent = label;
        });
        lastProgress = progress;
    }
    if (stage !== lastStage) {
        root.dataset.stage = stage;
        const complete = stage !== "locked";
        const opening = stage === "unlocking" || stage === "unlocked";
        document.querySelector("[data-session-status]").textContent = complete ? "READY" : "PREPARING";
        document.querySelector("[data-lock-caption]").textContent = opening ? "READY TO BOARD" : complete ? "FLIGHT READY" : "PRE-FLIGHT CHECK";
        document.querySelector("[data-access-status]").textContent = opening ? "OPEN" : complete ? "READY" : "PREPARING";
        document.querySelector('[data-terminal-title]').textContent = opening ? 'Access ready' : complete ? 'Checks complete' : 'Preparing access';
        document.querySelector("[data-node-status]").textContent = opening ? "REGISTRATION LINK READY" : "REGISTRATION ROUTE";
        progressLabel.textContent = opening ? "READY FOR TAKEOFF" : complete ? "FLIGHT DECK READY" : "PREPARING YOUR FLIGHT";
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
