# Playwright MCP smoke check: PASSED on retry

First attempt was blocked; the sections from "Goal" down record it as it happened.

## Retry result (2026-11-02, after the user allowed the package destinations)

- `install-deps` with the MCP server's bundled Playwright 1.65.0-alpha-2026-10-30
  exited 0 (`install-deps-retry.log`). `ldd` then reports no missing libraries.
- Browser: Google Chrome for Testing 157.0.8103.15, headless, via `browser_navigate`.
- https://example.com/ loaded with title `Example Domain` and 0 console errors or warnings.
- `example-com.png` (sha256 8757b6f760d44b0bb96f10cac556a38aec68c21fb7f8a715ece0cb6e02148c6d)
  was viewed: the book icon and example-domain notice render in English, Arabic,
  Chinese, French, Russian and Spanish. It is viewport-only (1280x720), so the
  "Learn more" link is below the fold; it is present in
  `page-2026-11-02T02-10-13-936Z.yml`.
- This shows only that the browser can launch, load a page and take a screenshot.
  It says nothing about the Doom port.
- The "Next action" section below is complete. `.playwright-mcp/` was moved here from
  the repo root; Playwright MCP may recreate it there on later navigations.

## First attempt: blocked

Manual request from the user, not a loop run. `artifacts/state.json` was not changed.

- **Source revision:** e500c440656622db5ab3f8fb7df73d8b5998eeb3, with uncommitted
  `loop/agents.yaml`, `artifacts/runs/`, `artifacts/state.json` and `evals/`
  already present at the start of the session. This check changed none of them
  apart from adding this directory.
- **Goal:** install the browser matching Playwright MCP, open a page, inspect a screenshot.
- **Outcome:** browser installed. Page not opened. No screenshot exists.

## Evidence

- `claude mcp list`: `playwright: npx -y @playwright/mcp@latest --headless --browser chromium - Connected`
- Versions: `@playwright/mcp` 0.0.84, `playwright` 1.65.0-alpha-2026-10-30.
- No `browser_install` tool is exposed by this server version. The server's error
  message names the CLI `install-browser` command instead, which succeeded.
- Installed in `~/.cache/ms-playwright`: `chromium-1252`, `chromium_headless_shell-1252`, `ffmpeg-1013`.
- `browser_navigate` fails with: `Missing system dependencies required to run browser chrome-for-testing`.
- `ldd` on the browser reports 20 missing libraries, including libglib-2.0, libgbm,
  libX11 and libasound. None of the four searched for are on disk.
- `install-deps` failed with exit code 100; see `install-deps.log`.
- The proxy answers `403 Approval required for ports.ubuntu.com:80`, directing
  review to `sbx policy approval ls`. `cli.github.com` and `download.docker.com`,
  which are also apt sources here, returned 403 as well.

## Next action

1. A human reviews the pending requests with `sbx policy approval ls`. The approval
   was not self-granted and the proxy was not bypassed.
2. Rerun, from `~`:
   `sudo -n /usr/bin/node ~/.npm/_npx/9833c18b2d85bc59/node_modules/playwright/cli.js install-deps chrome-for-testing`
3. Call `browser_navigate` on https://example.com, then save a screenshot to this directory.

`apt-get update` may also fail while the `cli.github.com` and `download.docker.com`
sources stay blocked, so step 2 may need those approved too, or those sources disabled.
