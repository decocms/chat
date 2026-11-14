# Native document Apps

Source parity with main 914d399: standalone `[[app:connection/tool]]` paragraphs mount an App; optional `|p`, `|m`, `|g` chooses 240/420/680px. Each card has an independent Apps session, consent queue and fresh nonce/MessagePort-bound AppFrame. The presentation module loads only when the document contains a rendered marker. Protected calls, context and outbound private payloads continue through the existing document-bound host.

P/M/G rewrites require the rendered source and document target to match the current DocumentSession. Put in doc uses the same owner's current target. A live editor performs the edit through its existing writer; preview writes use the existing bounded ACK/canonical-read and recovery mechanism. Pending, denied, stale-target and recovery states refuse another write. No second Yjs provider is created.

Two source fixtures cover duplicate marker occurrence, stale marker, invalid append, preview write confirmation and target/disposal rejection. Browser, Svelte/type, formatter and runtime claims remain pending at this source checkpoint. Side-by-side file parity is a subsequent change.

Follow-up review: paragraph source spans now come from the existing Marked/parse5 adapter metadata. Only the exact legal rendered paragraph can become a writable App slot; fenced code, indented code, comments and raw-HTML twins cannot redirect a size action. Frame identity excludes unrelated prose and size. Immutable source-bound controls update independently; duplicate cardinality changes revoke affected identical-marker grants.

Author verification: 16 initial and seven follow-up paths formatted with Node Prettier. Existing native document suite now passes 32 tests / 162 assertions (5.68s), including exact twin-source association and canonical reads arriving during preview writes. No Svelte/DOM/browser acceptance is claimed.

Nested placement follow-up: public Marked tokenizer hooks retain each semantic token’s remaining-input position, including skipped definitions. Verified corresponding-line maps preserve original quote/list prefixes and CRLF/lone-CR boundaries without searching sibling text. Quote and loose-list paragraphs render Apps; tight-list text has no paragraph and stays literal, matching the rendered-p baseline. The provenance walk is enabled only for document policy; chat and file-preview keep their existing lexer path. App-containing nested subtrees keep stable frame keys across unrelated prose and size edits.

Author verification for this follow-up: seven owned paths formatted; native document suite passed 37 tests / 193 assertions in 5.33s. Actual nested iframe/browser behavior remains a separate gate.
