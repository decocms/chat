# API-local validators behind the backend boundary

Source `9fd5b4f71a2947be217c896f71aa86aaa1396438` moves only `UploadHeaders`
and `AgentDbRow` from the browser-safe shared barrel into
`src/apiServerSchemas.ts`, using the existing server-only marker and backend
directory guard. API handlers import the same canonical names there. Public
DTOs, route behavior and inferred Hono request/response contracts are unchanged;
no frontend copy or unchecked assertion is introduced.

The actual route suite passes 41 tests / 382 assertions. New direct cases
retain optional/null handling, no coercion, unknown-key stripping and primitive
schema sharing. The [source check receipt](verification/9fd5b4f-backend-schema-source.json)
records all 24 mandatory gates passing. [Both OS jobs](https://github.com/vibegui/vibebook.dev/actions/runs/43685305053)
still fail original generated-preview freshness; layout checks pass. The
[complete real-Worker browser cohort](https://github.com/vibegui/vibebook.dev/actions/runs/43685312865)
also passes. Matching generated assets are refreshed from that checked build.
Final freshness/integration verification remains required.

A bounded scan of the emitted preview graph, compared with `eb50323`, finds
`ctx_tokens`, `ctx_window` and `ctx_limits` in one old JS file each and zero
new JS files. `x-filename` remains in one new JS file because it is a legitimate
upload header; its global absence would be an incorrect test. The source/build
boundary checks remain the general protection against backend runtime imports.

The whole emitted JS graph changes from 2584150 to 2583987 raw bytes and from
820463 to 820424 separately gzipped bytes. These totals include unrequested lazy
entries. This is a narrow architecture cleanup, not evidence of a meaningful
latency, initial-transfer or heap improvement. No performance budget is waived;
vanilla stays the maintained default. This branch does not adopt the separate
semantic-parser, lazy-App or rendering experiments.
