/* Browser lifecycle and timing. Build with Emscripten ASYNCIFY=1.
 * Video/input callbacks live in video_input.c. Sound is disabled for this MVP.
 */
#include "doomgeneric.h"

#include <emscripten.h>
#include <stdio.h>
#include <string.h>

static int started;
static int clock_started;
static double clock_origin;
/* The engine retains myargv, including across Asyncify suspensions. Do not
 * retain callMain's temporary argv storage or strings on its caller's stack.
 * These allocations intentionally live for the single module/game lifetime.
 */
static char **engine_argv;

uint32_t DG_GetTicksMs(void)
{
    double now = emscripten_get_now(); /* monotonic performance clock, not Date */
    if (!clock_started)
    {
        clock_origin = now;
        clock_started = 1;
    }
    /* Start at 1 because the engine uses zero as an uninitialized basetime.
     * Truncate fractional milliseconds; wrap only at the uint32 interface.
     */
    return (uint32_t)((uint64_t)(now - clock_origin) + 1u);
}

void DG_SleepMs(uint32_t ms)
{
    /* Asyncify unwinds and resumes the *same* engine stack. This also yields
     * inside TryRunTics and D_Display's screen-wipe waits, not just outside
     * doomgeneric_Tick. A zero-duration request still yields to the browser.
     */
    emscripten_sleep(ms);
}

int main(int argc, char **argv)
{
    int i;
    if (started)
        return 0; /* no duplicate initialization if callMain is invoked twice */
    started = 1;

    engine_argv = calloc((size_t)argc + 1, sizeof(*engine_argv));
    if (engine_argv == NULL)
        goto allocation_failed;
    for (i = 0; i < argc; ++i)
    {
        size_t size = strlen(argv[i]) + 1;
        engine_argv[i] = malloc(size);
        if (engine_argv[i] == NULL)
        {
            while (i > 0)
                free(engine_argv[--i]);
            free(engine_argv);
            engine_argv = NULL;
            goto allocation_failed;
        }
        memcpy(engine_argv[i], argv[i], size);
    }

    (void)DG_GetTicksMs();
    doomgeneric_Create(argc, engine_argv);
    /* One sequential continuation: never schedule overlapping main-loop or
     * timer callbacks while a tick is suspended. The supplied engine converts
     * elapsed milliseconds to its own 35 Hz tics; do not impose 60 Hz or add a
     * fixed 1/35-second delay here. The outer yield also covers fast-returning
     * ticks (e.g. timedemo), and lets input and Canvas presentation run.
     */
    for (;;)
    {
        doomgeneric_Tick();
        DG_SleepMs(1);
    }

allocation_failed:
    fputs("Unable to retain Doom startup arguments.\n", stderr);
    return EXIT_FAILURE;
}
