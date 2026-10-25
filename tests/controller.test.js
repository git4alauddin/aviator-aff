import test from "node:test";
import assert from "node:assert/strict";
import {playAccessSequence, getSequenceState} from "../js/animations.js";
import {config} from "../js/config.js";

function animationEnvironment(t) {
    const callbacks = new Map();
    const listeners = new Map();
    let id = 0;
    const document = {
        hidden: false,
        addEventListener: (name, callback) => listeners.set(name, callback),
        removeEventListener: (name) => listeners.delete(name),
    };
    const replacements = {
        document,
        requestAnimationFrame: (callback) => {
            callbacks.set(++id, callback);
            return id;
        },
        cancelAnimationFrame: (frameId) => callbacks.delete(frameId),
    };
    for (const [name, value] of Object.entries(replacements)) {
        const original = Object.getOwnPropertyDescriptor(globalThis, name);
        Object.defineProperty(globalThis, name, {configurable: true, writable: true, value});
        t.after(() => {
            if (original) Object.defineProperty(globalThis, name, original);
            else delete globalThis[name];
        });
    }
    return {
        callbacks,
        listeners,
        tick(now) {
            const pending = [...callbacks.values()];
            callbacks.clear();
            pending.forEach((callback) => callback(now));
        },
        hide(hidden) {
            document.hidden = hidden;
            listeners.get("visibilitychange")?.();
        },
    };
}

test("background time is excluded and cancelling releases frame/listener resources", (t) => {
    const environment = animationEnvironment(t);
    const states = [];
    let completions = 0;
    const stop = playAccessSequence({
        timing: config.sequence,
        onUpdate: (state) => states.push(state),
        onComplete: () => completions++
    });
    environment.tick(0);
    environment.tick(100);
    const beforeHide = states.at(-1);
    environment.hide(true);
    environment.tick(5000);
    assert.equal(states.at(-1), beforeHide);
    environment.hide(false);
    environment.tick(10000);
    environment.tick(10050);
    assert.deepEqual(states.at(-1), getSequenceState(150, config.sequence));
    assert.equal(completions, 0);
    stop();
    assert.equal(environment.callbacks.size, 0);
    assert.equal(environment.listeners.size, 0);
});

test("a stalled frame cannot skip 100%, unlocking, or trigger multiple handoffs", (t) => {
    const environment = animationEnvironment(t);
    const stages = [];
    let completions = 0;
    playAccessSequence({
        timing: config.sequence, onUpdate: ({stage}) => {
            if (stages.at(-1) !== stage) stages.push(stage);
        }, onComplete: () => completions++
    });
    environment.tick(0);
    environment.tick(100000);
    assert.equal(completions, 0);
    assert.deepEqual(stages, ["locked"]);
    for (let now = 100100; now <= 107000; now += 100) environment.tick(now);
    assert.deepEqual(stages, ["locked", "complete", "unlocking", "unlocked"]);
    assert.equal(completions, 1);
    assert.equal(environment.callbacks.size, 0);
    assert.equal(environment.listeners.size, 0);
});

