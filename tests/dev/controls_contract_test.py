#!/usr/bin/env python3
"""Exercise current platform bindings against real, read-only engine units."""
from pathlib import Path
import subprocess
import tempfile

root = Path(__file__).resolve().parents[2]
source = (root / 'platform/video_input.c').read_text()
bind = source.split('static void bind_controls(void)')[1].split('\nvoid DG_Init')[0]
harness = (root / 'tests/dev/input_engine_test.c').read_text()
harness = harness.replace('int main(int argc, char **argv) {', 'static void bind_controls(void)' + bind + '\nint main(int argc, char **argv) {')
harness = harness.replace('assert(key_fire == KEY_FIRE && key_use == KEY_USE);', 'bind_controls();')
harness = harness.replace('int expected, step = 0;', 'int expected, forward, side, turn, step = 0;')
harness = harness.replace('scanf("%d %d %d", &down, &code, &expected) == 3', 'scanf("%d %d %d %d %d %d", &down, &code, &expected, &forward, &side, &turn) == 6')
harness = harness.replace('if (actual != expected)', 'if (actual != expected || (cmd.forwardmove > 0) - (cmd.forwardmove < 0) != forward || (cmd.sidemove > 0) - (cmd.sidemove < 0) != side || (cmd.angleturn > 0) - (cmd.angleturn < 0) != turn)')
with tempfile.TemporaryDirectory() as tmp:
    tmp = Path(tmp)
    (tmp / 'harness.c').write_text(harness)
    engine = root / 'third_party/doomgeneric'
    command = ['clang', '-std=gnu11', '-w', '-ffunction-sections', '-fdata-sections', '-I' + str(engine), str(tmp / 'harness.c')]
    command += [str(engine / (unit + '.c')) for unit in ('i_input', 'd_event', 'g_game', 'm_controls', 'doomstat')]
    import sys
    command += ['-Wl,-dead_strip' if sys.platform == 'darwin' else '-Wl,--gc-sections', '-lm', '-o', str(tmp / 'engine')]
    subprocess.run(command, check=True)
    subprocess.run(['node', str(root / 'tests/dev/controls_contract_test.cjs'), str(tmp / 'engine')], cwd=root, check=True)
