# Inactive ordinary rich-content path experiment

This candidate starts from `60bb255`. The retained complete baseline/candidate cohorts and their failed original budgets are not modified. No latency, heap, byte, font or acceptance improvement is claimed by this source change.

RichContent owns one RichSession. Its cached synchronous display result is either a parsed normal source or an explicitly pending raw-HTML request anchored to source/mode/policy. Human, inline, literal and HTML-free Markdown render through the existing context-memoized projection and local body snippet. They create no HTML preparation child, writable, controller, loading effect or scope serialization. The lexer/source-span preflight remains the same and runs once per syntax change; normal display results retain the parsed syntax rather than lexical tokens.

Only raw HTML mounts HtmlRichSource. That child owns the existing preparation state, deadline, abort, status and Retry. It supplies the already lexed source to readPrepared, reusing exact tokens through a failed load and Retry. Ready acquisition is paired with its captured request/input/store. Its post-ready effect asks the parent to adopt that exact request; the parent checks current source/mode/policy/account/room before the session accepts the request identity. Svelte's overridable derived display then selects the ordinary body and disposes the HTML child. The child does not render a second copy of the rich body before adoption.

Successful acquisition clears the controller's supplied tokens; a payload-free ready flag keeps same-input store reuse stable. Session adoption drops the pending syntax request without mutating shared prepared objects. Source changes clear the previous projection/context cache before a pending HTML request can retain another source tree. Retired controllers clear callback references as well as source/token holders, and use the captured deadline rather than retaining the original options object. No global parser-ready cache is introduced.

DocumentPreview and Mermaid source files are unchanged. Their existing preparation and asynchronous diagram boundaries remain in use. Whole-input parse5 fallback, the semantic token walk, URL/entity decoding, sanitizer, source/depth/node budgets, source spans, canonical readiness, sole stylesheet and font behavior are unchanged.

The focused fixtures retain all previous semantic/security assertions and add session syntax/cache/adoption checks, exact token reuse through Retry, actual mounted normal-owner/controller instrumentation with a positive HTML control, and HTML/ordinary/source/scope transition cases. Mounted fixtures require the separately authorized compiler/DOM lane. Full functional checks and the unchanged complete performance cohort remain required before any adoption. Test counts and immutable source hash are reported separately.

## Combined source verification

The combined isolated candidate includes the reviewed lazy chat-App owner and
the deployed token-retirement changes. At `3399322`, the complete
[real-Worker browser cohort](https://github.com/vibegui/vibebook.dev/actions/runs/43679620510)
and layout browser checks pass. Its [first repository run](https://github.com/vibegui/vibebook.dev/actions/runs/43679614891)
passes 23 of 24 source gates, including actual mounted UI tests, but fails
tooling typing: an optional adoption result was passed to an identity matcher
without narrowing. The [failed source receipt](verification/3399322-rich-fastpath-source-failure.json)
retains that failure. No cast, suppression or weakened assertion was used.

`2c150ee251b9372974e25a49ecdadc0fcadcf2ba` adds an explicit runtime guard in
that test only. Application sources, shared contracts, backend and generated
assets have no diff between those two source checkpoints. Its [new repository
run](https://github.com/vibegui/vibebook.dev/actions/runs/43680084591) passes all
24 source gates on Ubuntu and macOS plus layout browser checks. The original
run still fails generated-preview freshness; the [exact source receipt](verification/2c150ee-rich-fastpath-source.json)
distinguishes that from source checks. Matching preview assets are now refreshed
from that build. Final freshness, security/HMR and a new unchanged complete
performance cohort remain required. This is not deployed or adopted.
