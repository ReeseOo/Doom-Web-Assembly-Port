#!/usr/bin/env python3
"""Compile real engine units then run the EM_JS regression check against them.
Run from any directory: python3 tests/dev/input_engine_test.py.
Requires host clang and Node; no WAD, browser, or engine modifications needed.
"""
import os
from pathlib import Path
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[2]
with tempfile.TemporaryDirectory(prefix="doom-input-") as tmp:
    binary = Path(tmp) / "input-engine"
    engine = ROOT / "third_party/doomgeneric"
    command = ["clang", "-std=gnu11", "-w", "-ffunction-sections", "-fdata-sections",
               "-I" + str(engine), str(ROOT / "tests/dev/input_engine_test.c")]
    command += [str(engine / (unit + ".c")) for unit in
                ("i_input", "d_event", "g_game", "m_controls", "doomstat")]
    command += ["-Wl,-dead_strip" if sys.platform == "darwin" else "-Wl,--gc-sections",
                "-lm", "-o", str(binary)]
    print("+", " ".join(command), flush=True)
    subprocess.run(command, cwd=ROOT, check=True)
    subprocess.run(["node", "tests/dev/video_input_test.cjs"], cwd=ROOT,
                   env=dict(os.environ, DOOM_INPUT_ENGINE=str(binary)), check=True)
