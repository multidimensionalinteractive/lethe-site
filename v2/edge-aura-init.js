import {
    createAuraEngine,
    EDGE_AURA_PRESETS,
    keyCodeToPosition
} from "https://esm.sh/edge-aura@0.6.0";

const ARCHIVE_PALETTE = [
    [0.0, [42, 69, 80]],
    [0.16, [62, 90, 74]],
    [0.34, [138, 115, 72]],
    [0.52, [143, 52, 40]],
    [0.7, [106, 74, 98]],
    [0.86, [58, 58, 56]],
    [1.0, [42, 69, 80]]
];

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const canvas = document.getElementById("edge-aura-canvas");

if (!canvas) {
    throw new Error("edge-aura canvas missing");
}

const engine = createAuraEngine(canvas, {
    ...EDGE_AURA_PRESETS.subtle,
    geometry: {
        inset: 0,
        cornerRadius: 16,
        band: 78,
        topEdgeFade: 0
    },
    palette: {
        stops: ARCHIVE_PALETTE,
        pastel: 0.22,
        ringAlpha: 0.72,
        background: "dark",
        normalize: true
    },
    motion: {
        rotateIdleS: 14,
        rotateTypingS: 8,
        kindleDurS: 1.1
    }
});

let last = performance.now();
let rafId = 0;

function tick(now) {
    rafId = requestAnimationFrame(tick);
    engine.step(now - last);
    last = now;
    engine.render();
}

function start() {
    if (reducedMotion) {
        engine.renderStatic();
        return;
    }
    cancelAnimationFrame(rafId);
    last = performance.now();
    rafId = requestAnimationFrame(tick);
}

function stop() {
    cancelAnimationFrame(rafId);
}

window.addEventListener("resize", () => {
    engine.resize();
    if (reducedMotion) engine.renderStatic();
});

document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
        stop();
        return;
    }
    start();
});

window.addEventListener("pointerdown", (event) => {
    if (reducedMotion) return;
    engine.tap({ x: event.clientX, y: event.clientY });
}, { passive: true });

window.addEventListener("keydown", (event) => {
    if (reducedMotion) return;
    const pos = keyCodeToPosition(event.code);
    if (pos) engine.key(pos.x);
}, { passive: true });

start();
engine.kindle(window.innerWidth * 0.18, window.innerHeight * 0.22);
