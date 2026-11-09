# Integration review: web/index.html (any-key menu guidance)
Verdict: PASS

- Diff is limited to web/index.html (copy/layout of menu-prompt, Start button moved after prompt, status text). No JS logic changed; element IDs (start, fullscreen, canvas, status, menu-prompt, menu-next) preserved, aria-describedby still valid.
- build.sh copies web/index.html verbatim; dist/index.html is byte-identical to the working copy.
- Evidence: gate.log all checks PASS (B1-B3, R1-R3, T1, I1, I2, A1, G1, M1, S1), complete, verdict PASS, rev 334193053c.
- Only non-artifact change in tree is web/index.html; protected dirs unchanged (B2 pass).
- Non-blocking: results.json records uncommitted_files=1, expected since the gate ran pre-commit.
