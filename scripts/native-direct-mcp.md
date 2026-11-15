# Native direct MCP source checkpoint

A RoomScope owns its connection catalog, mode map, initialized SDK sessions and
short-lived identity credentials. Only a successful authorized catalog read
populates it. Scope departure, known membership/session denial, catalog removal
or connection mutation closes the applicable session before further work.
Credentials stay in closures; the UI receives only direct/proxy mode.

The inferred identity POST is runtime-validated. Identity-token connections that
are not signed in can initialize the existing browser SDK lazily. Token and OAuth
connections keep the proxy path. The conservative credential deadline starts
before the identity request and requires thirty seconds remaining at bootstrap.
Expired sessions close; an explicit subsequent call can bootstrap again.

Only initialization failures can select the proxy. Cancellation and established
access denial propagate. After a tools/call attempt starts, transport/result
failures never replay through the proxy. The public SDK relatedRequestId option
carries private adapter context, stripped before the concrete HTTP transport;
this retains each concurrent operation's AbortSignal across asynchronous SDK
headers. Each operation permits one POST. No authProvider, redirect following,
SSE reconnection or session DELETE is enabled. Cancellation aborts the owned
HTTP request and sends no later cancellation RPC. This does not claim rollback
of an operation already received by the server.

Existing AppFrame opening/action consent and the private per-document bridge
remain the dispatch boundary. Room Apps keep their original path. SDK imports,
identity requests and factory completions are fenced by owner/caller cancellation;
an ignored late completion cannot attach a retired session.

Author checks: Node formatting of the new test and package/tooling registrations
passed. The first pure run exposed a test fixture passing the manual-clock wrapper
instead of its clock port; corrected without production changes. The equivalent
three-file test:apps command then passed 31 tests / 185 assertions in 3.09 seconds.
The shell wrapper initially could not find bun on PATH; tests used the pinned Bun
1.4.4 executable directly. Actual SDK HTTP fixtures cover JSON/SSE, identity/session
headers, redirect policy, tool failures and concurrent abort signals. Separate
pure owner fixtures with an injected SDK factory cover catalog/owner revocation,
delayed import cancellation, rejection of a late identity proof and setup-only
fallback. They do not exercise the expiry timer. The direct tests are also
registered in the mandatory test:store gate.

This receipt is not Worker/browser, provider intelligence, hardware, typography,
performance or deployment acceptance. Strict types and the separate actual
Worker/JWKS/CORS/private-frame probe are owned by the root integration checks.
