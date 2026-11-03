#!/usr/bin/env python3
"""Development-only runtime contract test; not a browser/Asyncify acceptance test."""
import pathlib
import subprocess
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[2]
HARNESS = r'''
#include <assert.h>
#include <setjmp.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>
#define main runtime_main
#include "doomgeneric_runtime.c"
#undef main
static double now = 45000.25;
static jmp_buf stop;
static int creates, ticks, inside_tick, sleeps;
static char *incoming[] = {"doom", "-iwad", "/doom1.wad", NULL};
double emscripten_get_now(void) { return now; }
void emscripten_sleep(unsigned int ms) {
    ++sleeps;
    if (inside_tick) assert(ms == 7);
    else assert(ms == 1 || ms == 0 || ms == 123);
    now += ms;
}
void doomgeneric_Create(int argc, char **argv) {
    assert(++creates == 1);
    assert(argc == 3 && argv != incoming && argv[3] == NULL);
    for (int i = 0; i < argc; ++i) {
        assert(argv[i] != incoming[i]);
        assert(strcmp(argv[i], incoming[i]) == 0);
    }
    assert(runtime_main(3, incoming) == 0); /* repeat start is a no-op */
}
void doomgeneric_Tick(void) {
    assert(!inside_tick);
    inside_tick = 1;
    ++ticks;
    uint32_t before = DG_GetTicksMs();
    DG_SleepMs(7); /* stand-in for a nested tic/wipe wait */
    assert(DG_GetTicksMs() == before + 7);
    assert(runtime_main(3, incoming) == 0);
    inside_tick = 0;
    if (ticks == 3) longjmp(stop, 1);
}
int main(void) {
    assert(DG_GetTicksMs() == 1);
    now += 0.5;
    assert(DG_GetTicksMs() == 1);
    now += 1;
    assert(DG_GetTicksMs() == 2);
    DG_SleepMs(0);
    DG_SleepMs(123);
    if (!setjmp(stop)) runtime_main(3, incoming);
    assert(creates == 1 && ticks == 3 && sleeps == 7);
    now = clock_origin + 4294967296.0;
    assert(DG_GetTicksMs() == 1); /* uint32 interface wraps */
    puts("PASS: monotonic ms, zero/nonzero sleep forwarding, persistent argv, single startup, sequential nested waits and outer yields");
    return 0;
}
'''
with tempfile.TemporaryDirectory(prefix="doom-runtime-test-") as directory:
    temp = pathlib.Path(directory)
    (temp / "emscripten.h").write_text(
        "double emscripten_get_now(void);\nvoid emscripten_sleep(unsigned int ms);\n")
    (temp / "runtime_test.c").write_text(HARNESS)
    subprocess.run([
        "clang", "-std=c11", "-Wall", "-Wextra", "-Werror", "-fsanitize=address,undefined",
        "-I" + str(temp), "-I" + str(ROOT / "platform"),
        "-I" + str(ROOT / "third_party/doomgeneric"),
        str(temp / "runtime_test.c"), "-o", str(temp / "runtime_test")
    ], check=True)
    subprocess.run([str(temp / "runtime_test")], check=True)
