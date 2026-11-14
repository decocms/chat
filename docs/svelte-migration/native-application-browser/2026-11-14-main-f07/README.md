# Integrated main checkpoint, not final acceptance

[Integrated native application run 43614897139](https://github.com/vibegui/vibebook.dev/actions/runs/43614897139)
and [App document transport run 43614897120](https://github.com/vibegui/vibebook.dev/actions/runs/43614897120)
pass at PR head `64fd62a`, tested as merge `8a7351e269d8bd9bb3f6837d604637fe5e372d33`.
Main through `f07d6a2` is included. The original JSON is copied unchanged;
[provenance.json](provenance.json) records exact identities and SHA-256 hashes.

The integrated suite exercises actual local Worker HTTP/MCP, Book/D1/R2 and
DocRoom flows, native/vanilla document collaboration, twenty editor lifecycle
cycles and eight EN/PT light/dark desktop/mobile profiles. Its report records no
uncaught page errors, no accessibility failures, and owned process cleanup.
Native and vanilla App initial-read/replacement-denial reports are retained.
The separate transport suite includes actual file POST and adversarial routing.
Model review decisions are controlled fixtures; the Worker, storage and App
transport are real disposable local instances.

This checkpoint predates the native inline document-App/card followups, the
late Fire membership fence and the new dictation/Fire/file-side ports. Passing
these existing scenarios does not establish parity for those added behaviors.
The repository check workflow at the same checkpoint fails source checks and
the new gallery Inbox-width scenario, plus stale committed generated assets;
its failures are not hidden by these passing application suites. Combined-head
source, layout, new-feature browser, performance, real-provider, production and
hardware/manual acceptance remain required. Vanilla remains default.
