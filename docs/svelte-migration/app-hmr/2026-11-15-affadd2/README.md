# HMR verification at affadd2

[Attempt 1](https://github.com/vibegui/vibebook.dev/actions/runs/43669338342/attempts/1) failed on a Yjs upgrade through Vite with ECONNRESET/socket hang up; the direct Worker upgrade returned 101. Cleanup passed and no source mutations remained. [Attempt 2](https://github.com/vibegui/vibebook.dev/actions/runs/43669338342/attempts/2) reran the same source and assertions unchanged and passed all ten steps, with seven exact source restorations and no cleanup errors. The reset's cause is unproved; no product fix or assertion relaxation is claimed. Both original results and runner receipts remain separate, with exact hashes and distinct artifact IDs.

The two attempts share an artifact name. A download by name returned the older failed artifact; the passing receipt was fetched explicitly by ID14143078636 and its status/revision checked. This is local-development HMR evidence, not production or full migration acceptance.
