# Combined current-main browser checkpoint passes

Source `43bedea60a43076bdd34b6e0c1dc05fb243af127`, including main `868b375`,
passes the full maintained `test:native-application:ci` suite on isolated
BugMachine after a fresh native build and all 24 repository gates passed.
The generated preview is refreshed from that source. Original safe JSON reports
are copied unchanged; [provenance.json](provenance.json) records exact hashes.

The full cohort includes real Worker/Book/D1/R2/DocRoom core flows, bidirectional
native/default document collaboration, all twenty editor/socket lifecycle cycles,
and eight EN/PT light/dark desktop/mobile application profiles. Native/default
App navigation and replacement-document authority checks pass.

The new independent inline App audit passes in both variants: real controlled
OAuth/PKCE, stock SDK reading the canonical document, independent reader grants,
Cancel/Reopen, no implicit initial replay, pending-marker removal, full-width
document Apps, and explicit independent denials after same-frame replacement.
It also invokes the actual MCP `app_open` tool and verifies that neither variant
initializes a remote App before its reader's Open/Allow. Provider counters remain
unchanged while that reader decision is pending.

This cohort uses disposable DEV identities and a controlled external MCP
provider. It does not exercise real microphone/Whisper, dedicated Haiku runner
hardware, production OAuth/deployment, manual assistive technology, Safari or
performance budgets. Those acceptance gates remain open. Pushed-head GitHub
checks and HMR still need to revalidate this checkpoint.
