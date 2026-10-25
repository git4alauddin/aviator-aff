import {config} from './config.js';
import {mountRegistrationFlow} from './registration-flow.js';
import {mountActivityTicker} from './activity-ticker.js';
import {mountRegistrationAudio} from './registration-audio.js';
import {mountDraggableWidget} from './draggable-widget.js';

document.querySelector('link[rel="canonical"]').href = new URL('registration.html', config.siteUrl).href;

document.querySelectorAll('[data-creator-link]').forEach(link => {
    link.hidden = !config.creatorStudio.enabled;
    link.href = config.creatorStudio.url;
});
const audio = document.querySelector('[data-registration-audio]');
let guidance = {destroy() {}};
if (config.guidance.enabled && config.guidance.src) {
    audio.src = config.guidance.src;
    guidance = mountRegistrationAudio(document);
}
const flow = mountRegistrationFlow(document);
const ticker = mountActivityTicker(document.querySelector('[data-activity-ticker]'));

// The external iframe is never read: visitor results are local preset previews.
const presets = globalThis.SIM_CONFIG.crashPoints.filter(value => Number.isFinite(value) && value >= 1);
let sequence = -1;
let selected = {id: 1, phase: 'waiting', target: presets[0]};
window.mountAviatorPrediction(globalThis.SIM_CONFIG.prediction, () => selected, {
    onPredict() {
        sequence++;
        selected = {id: sequence + 1, phase: 'waiting', target: presets[sequence % presets.length]};
    },
});
const draggable = ['[data-deposit-widget]', '#predictLauncher']
    .map(selector => mountDraggableWidget(document.querySelector(selector)));

window.addEventListener('pagehide', () => {
    draggable.forEach(control => control.destroy());
    guidance.destroy(); flow.destroy(); ticker.destroy();
}, {once: true});
window.addEventListener('pageshow', event => { if (event.persisted) location.reload(); });
