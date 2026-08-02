import {
    createAuraEngine,
    EDGE_AURA_PRESETS,
    keyCodeToPosition
} from "https://esm.sh/edge-aura@0.6.0";

/* Oil-slick rainbow — the living contemporary force inside the structure */
const OIL_SLICK_PALETTE = [
    [0.0, [63, 163, 148]],     /* teal        */
    [0.18, [21, 94, 122]],     /* petrol      */
    [0.36, [104, 67, 126]],    /* violet      */
    [0.54, [150, 62, 112]],    /* magenta     */
    [0.72, [183, 103, 62]],    /* copper      */
    [0.9, [197, 164, 72]],     /* gold        */
    [1.0, [63, 163, 148]]      /* teal wrap   */
];

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const canvas = document.getElementById("edge-aura-canvas");

if (canvas) {
    const engine = createAuraEngine(canvas, {
        ...EDGE_AURA_PRESETS.subtle,
        geometry: {
            inset: 0,
            cornerRadius: 16,
            band: 82,
            topEdgeFade: 0
        },
        palette: {
            stops: OIL_SLICK_PALETTE,
            pastel: 0.2,
            ringAlpha: 0.68,
            background: "dark",
            normalize: true
        },
        motion: {
            rotateIdleS: 16,
            rotateTypingS: 9,
            kindleDurS: 1.2
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
        rafId = requestAnimationFrame(tick);
    }

    function stop() {
        cancelAnimationFrame(rafId);
    }

    document.addEventListener("keydown", (event) => {
        const pos = keyCodeToPosition(event.keyCode);
        if (pos) engine.kindle(pos);
    });

    const visibility = document.visibilityState;
    if (visibility === "visible") start();
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") start();
        else stop();
    });
}
