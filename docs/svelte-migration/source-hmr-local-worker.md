# Source HMR uses a local-only Worker

Published source `139573a` failed managed HMR run `43632716991`: API declarations and MCP built, then the Worker exited in about two seconds; Vite never started. The old outer readiness poll masked that terminal exit as a ten-minute readiness timeout.

A fresh isolated BugMachine worktree at the exact revision, frozen dependencies, Node 22.23.5 and Bun 1.4.4 reproduced exit 1 in 2.713s (Worker phase failed after 2.087s). With synthetic DEV variables, no Cloudflare key environment and an empty owned auth configuration, private stderr matched Wrangler's noninteractive authentication requirement. Raw logs, generated session variables and local state remain private; safe receipts retain only exit code, timing, startup phases and fixed error classifications.

The development supervisor now explicitly requests `wrangler dev --local`, matching the managed real-application runner. The new AI binding otherwise participates in Wrangler's automatic remote-binding startup. This development/HMR gate intentionally uses local resources and does not prove live Workers AI, Whisper, external providers or runner behavior. Production configuration, authentication, public-fetch restrictions, assertions and readiness deadlines are unchanged.

The outer HMR poll now observes the exact owned launcher's terminal result before and after each probe, outside the transient HTTP/navigation catch. It records only the exit code and elapsed time, fails immediately, and retains the existing owned cleanup path. An older launch cannot poison a replacement launch's readiness. Shutdown checks still allow the expected process exit. Readiness misses never restart a process.

Source formatting passed for the three affected scripts. The existing supervisor readiness fixture now explicitly requires the local Worker flag. Fixed startup, focused fixtures and the complete managed HMR scenario are pending remote verification at this checkpoint.
