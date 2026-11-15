# Idempotent room playback candidate

This isolated candidate starts from `249e1e9`. It is an unmeasured hypothesis about redundant animation writes, not performance acceptance. Original workloads, readiness checks and budgets remain unchanged.

The retained timestamp-order diagnostics attribute substantial entry intervals to the geometry measurement frame. Sampling does not establish invocation counts or prove that playback writes cause forced layout. The existing batched geometry reads remain unchanged.

Playback still calls `getAnimations()` on every request and selects the current animation by name, effect and exact element. It skips `pause()` only when already paused, and skips the current-time setter only when the animation has no pending task and already has the requested time. A pending pause must still be completed by that setter, even when the observed time matches. Replacement animations, externally resumed playback and externally changed times are corrected without caching animation identity or progress.

The [Web Animations current-time setter](https://www.w3.org/TR/web-animations-1/#setting-the-current-time-of-an-animation) completes a pending pause. The controlled fixture models that distinction; it does not claim real browser animation or layout proof.

Author verification: isolated Bun playback suite, seven tests and 35 assertions passed. It covers replacement animation discovery, external resume/time changes, pending pause at the same time, finite/clamped input, wrong name/target, retry, suspension, disposal and bounded unavailability. Its mandatory `test:build` registration uses a separate Bun process because the fixture owns DOM/RAF/performance globals. Tooling includes the fixture explicitly.

Actual strict compilation, room DOM/layout/browser gates and fresh diagnostic comparisons remain required. In particular, first-frame sizing, visual-viewport changes, hidden-document/Board transitions, additional Inbox width playback and real CSS animation replacement must remain correct. No byte, CPU or heap reduction is claimed.
