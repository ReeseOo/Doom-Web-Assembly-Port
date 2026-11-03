#include <stdint.h>
#include <emscripten.h>
#include "doomgeneric.h"
#include "doomkeys.h"
#include "video_input.h"

#ifdef CMAP256
#error "Canvas backend requires the supplied 32-bit framebuffer"
#endif

/* Keep browser state on Module, not in cached views of growable WASM memory. */
EM_JS(void, video_init, (int width, int height, int fire_key, int use_key), {
    if (Module.doomVideoInput) return;
    const canvas = Module.canvas || document.getElementById('canvas');
    if (!canvas) throw new Error('Doom canvas missing');
    canvas.width = width;
    canvas.height = height;
    canvas.tabIndex = 0;
    const context = canvas.getContext('2d', {alpha: false});
    if (!context) throw new Error('Canvas 2D unavailable');
    const state = {
        canvas: canvas, context: context,
        image: context.createImageData(width, height),
        queue: [], head: 0, physical: new Map(),
        held: new Uint16Array(256), delivered: new Uint8Array(256)
    };
    Module.doomVideoInput = state;

    // Action codes come from supplied doomkeys.h, not PC modifier/ASCII
    // codes: m_controls.c binds fire/use to KEY_FIRE/KEY_USE.
    // Letters are lowercase engine bindings.
    const keys = {
        ArrowRight: 0xae, ArrowLeft: 0xac, ArrowUp: 0xad, ArrowDown: 0xaf,
        Escape: 27, Enter: 13, NumpadEnter: 13, Tab: 9, Backspace: 127,
        ControlLeft: fire_key, ControlRight: fire_key,
        ShiftLeft: 0xb6, ShiftRight: 0xb6, AltLeft: 0xb8, AltRight: 0xb8,
        Space: use_key, Minus: 45, Equal: 61, Comma: 44, Period: 46,
        Slash: 47, BracketLeft: 91, BracketRight: 93, Pause: 255,
        F1: 0xbb, F2: 0xbc, F3: 0xbd, F4: 0xbe, F5: 0xbf, F6: 0xc0,
        F7: 0xc1, F8: 0xc2, F9: 0xc3, F10: 0xc4, F11: 0xd7, F12: 0xd8
    };
    function translate(code) {
        if (Object.prototype.hasOwnProperty.call(keys, code)) return keys[code];
        if (/^Key[A-Z]$/.test(code)) return code.charCodeAt(3) + 32;
        if (/^Digit[0-9]$/.test(code)) return code.charCodeAt(5);
        return 0;
    }
    function enqueue(down, key) {
        if (state.head) {
            state.queue = state.queue.slice(state.head);
            state.head = 0;
        }
        if (state.queue.length >= 1024) {
            // Bounded overflow recovery: release engine-visible keys, then
            // reconcile to physical state. Never silently lose a release.
            state.queue = [];
            for (let k = 1; k < 256; ++k)
                if (state.delivered[k]) state.queue.push([0, k]);
            for (let k = 1; k < 256; ++k)
                if (state.held[k]) state.queue.push([1, k]);
        } else {
            state.queue.push([down, key]);
        }
    }
    function releaseAll() {
        state.physical.clear();
        for (let k = 1; k < 256; ++k) {
            if (state.held[k]) {
                state.held[k] = 0;
                enqueue(0, k);
            }
        }
    }
    window.addEventListener('keydown', function (event) {
        if (document.activeElement !== canvas || event.isComposing) return;
        const key = translate(event.code);
        if (!key) return;
        event.preventDefault(); // arrows/space/tab must not scroll/change focus
        if (state.physical.has(event.code) || event.repeat) return;
        state.physical.set(event.code, key);
        if (++state.held[key] === 1) enqueue(1, key);
    });
    window.addEventListener('keyup', function (event) {
        // Release even if focus changed between keydown and keyup.
        const key = state.physical.get(event.code);
        if (!key) return;
        event.preventDefault();
        state.physical.delete(event.code);
        if (--state.held[key] === 0) enqueue(0, key);
    });
    canvas.addEventListener('pointerdown', function () { canvas.focus(); });
    canvas.addEventListener('blur', releaseAll);
    window.addEventListener('blur', releaseAll);
    document.addEventListener('visibilitychange', function () {
        if (document.hidden) releaseAll();
    });
});

EM_JS(void, video_draw, (const uint32_t *pixels), {
    const state = Module.doomVideoInput;
    if (!state || !pixels) return;
    const out = state.image.data;
    const base = pixels >>> 2;
    // Engine packs 0x00RRGGBB, not RGBA. Reacquire HEAPU32 each call because
    // ALLOW_MEMORY_GROWTH can replace the underlying ArrayBuffer.
    for (let i = 0, j = 0; j < out.length; ++i, j += 4) {
        const pixel = HEAPU32[base + i];
        out[j] = (pixel >>> 16) & 255;
        out[j + 1] = (pixel >>> 8) & 255;
        out[j + 2] = pixel & 255;
        out[j + 3] = 255;
    }
    state.context.putImageData(state.image, 0, 0);
});

EM_JS(int, video_get_key, (int *pressed, unsigned char *key), {
    const state = Module.doomVideoInput;
    if (!state || state.head === state.queue.length) return 0;
    const event = state.queue[state.head++];
    HEAP32[pressed >>> 2] = event[0];
    HEAPU8[key] = event[1];
    state.delivered[event[1]] = event[0];
    if (state.head === state.queue.length) {
        state.queue = [];
        state.head = 0;
    }
    return 1;
});

EM_JS(void, video_title, (const char *title), {
    if (title) document.title = UTF8ToString(title);
});

void DG_Init(void)
{
    video_init(DOOMGENERIC_RESX, DOOMGENERIC_RESY, KEY_FIRE, KEY_USE);
}

void DG_DrawFrame(void)
{
    video_draw(DG_ScreenBuffer);
}

int DG_GetKey(int *pressed, unsigned char *key)
{
    if (!pressed || !key) return 0;
    return video_get_key(pressed, key);
}

void DG_SetWindowTitle(const char *title)
{
    video_title(title);
}
