# DOOM in the Browser — Multi-Agent Engineering Capstone

A browser-playable port of DOOM built from the supplied **doomgeneric C engine**, compiled to **WebAssembly with Emscripten**. The project pairs a playable game with an engineering experiment: using specialized coding agents, independent reviewers, and browser QA to implement and verify a substantial software change.

Originally developed as a UCLA fellowship capstone, this repository contains the port, browser integration, acceptance checks, and saved development evidence—not just a compiled demo.

## Features

- Keyboard-controlled shareware Episode 1, using the included `assets/doom1.wad`.
- Canvas rendering with pixelated scaling and a fullscreen option.
- Browser-compatible runtime timing and keyboard input.
- WebAudio sound effects and music playback.
- Save/load through DOOM’s menus, with browser-local persistence using IndexedDB.
- Automated Chromium acceptance checks, independent code reviews, and screenshot-based browser QA.

The engine comes from `third_party/doomgeneric/`; this is not a wrapper around an existing browser port.

## Build and play locally

### Requirements

- **Emscripten 4.0.18**, activated in your shell. The build script enforces this exact version.
- Bash and Python 3 for the commands below.
- A modern desktop browser with JavaScript, WebAssembly, WebAudio, and IndexedDB support.

From the repository root:

```bash
bash ./build.sh
python3 -m http.server 8000 --directory dist
```

Open **http://localhost:8000**, wait for loading to finish, and click **Start Doom**. Click the game canvas to focus it. The title/demo screen is normal; press **Escape**, then select **New Game** to play.

Serve `dist/` over HTTP rather than opening `index.html` directly: the page needs to fetch its WebAssembly and packaged game data.

### Build with Docker instead

The supplied Dockerfile pins the Emscripten toolchain and installs the browser test tools. With Docker running:

```bash
docker build -t doom-capstone-toolchain .
docker run --rm -v "$PWD":/workspace -w /workspace \
  doom-capstone-toolchain bash ./build.sh
python3 -m http.server 8000 --directory dist
```

## Controls

| Key | Action |
| --- | --- |
| W / S | Move forward / backward |
| A / D | Strafe left / right |
| Left / Right arrows | Turn |
| Space | Fire |
| E | Use / open doors |
| Shift | Run |
| 1–7 | Select weapon, when available |
| Escape | Open menu / go back |
| Up / Down arrows | Navigate menus |
| Enter | Select menu item |

Use the page’s **Fullscreen** button to expand the game. Audio may require a click or keypress to unlock, depending on browser policy.

### Saved games

Use DOOM’s **Save Game** and **Load Game** menus. Saves persist in the same browser profile on the same site; they are not synced to GitHub or another device. Changing the host or port creates a different browser origin, and clearing site data removes the saves.

## Verification and evidence

The acceptance suite checks builds, protected source integrity, browser loading, rendering, input, audio, gameplay interactions, and save persistence. See [`tests/accept/CRITERIA.md`](tests/accept/CRITERIA.md) for exact definitions and limitations.

To run it, activate Emscripten 4.0.18 on the host, start Docker, and build the `doom-capstone-toolchain` image as shown above. The suite also requires the repository’s `acceptance-v1` baseline tag:

```bash
git tag --list acceptance-v1
bash tests/accept/run.sh artifacts/manual-check
```

The suite rebuilds the game and writes results and supporting evidence to the chosen directory. It uses a clean copy of the tagged browser checks; a missing baseline tag is a prerequisite failure, not a reason to create a new baseline arbitrarily.

The saved completion record in [`artifacts/state.json`](artifacts/state.json) reports a passing acceptance run, passing independent correctness and integration reviews, and passing browser QA. These are historical results for the recorded revision, not a guarantee that every later checkout or browser will pass.

### Known limits

- Browser QA is primarily desktop Chromium-based; other browsers and mobile controls are not comprehensively verified.
- Passing checks does not establish perfect game feel, exact audio fidelity, every level’s behavior, or long-session stability.
- Door interactions and combat have limited observational evidence; enemy kills and full level progression are not established by the recorded QA.
- Browser saves depend on local storage availability and site identity.

## Engineering approach

The project separates coding, review, and testing responsibilities. Implementation work is divided among build/browser integration, video/input, runtime, and audio specialists. Build and acceptance exit codes supply executable evidence; independent reviews and browser interaction add checks that automated assertions alone cannot provide.

Run state, handoffs, failures, review findings, and screenshots are preserved under `artifacts/` so work can be resumed and conclusions traced to evidence. The original capstone also calls for evaluating recovery from injected regressions; the existence of that requirement should not be mistaken for proof that every evaluation has been completed.

## Repository layout

| Path | Purpose |
| --- | --- |
| `platform/` | C runtime, framebuffer/input, and audio integration |
| `web/` | Browser page and save persistence |
| `build.sh` | Emscripten build entry point |
| `Dockerfile` | Pinned compiler and browser-testing environment |
| `third_party/doomgeneric/` | Supplied DOOM engine source |
| `assets/` | Supplied shareware game data |
| `tests/accept/` | Protected acceptance checks and criteria |
| [`loop/`](loop/README.md) | Agent-loop materials and configuration |
| [`artifacts/`](artifacts/README.md) | Saved state, handoffs, reviews, logs, and test evidence |
| `build/`, `dist/` | Generated intermediate files and browser deliverables |

## Credits and licensing

DOOM was created by **id Software**. This project builds on the supplied **doomgeneric** engine sources and their contributors’ work.

See [`LICENSE`](LICENSE) for the repository’s GPLv2 license text and the supplied engine files for their notices. The shareware WAD is game data with separate terms; do not assume the source-code license applies to it. This repository uses the supplied shareware data, not commercial DOOM WADs.
