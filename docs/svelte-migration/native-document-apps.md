# Native document Apps

Source parity with main 914d399: standalone `[[app:connection/tool]]` paragraphs mount an App; optional `|p`, `|m`, `|g` chooses 240/420/680px. Each card has an independent Apps session, consent queue and fresh nonce/MessagePort-bound AppFrame. The presentation module loads only when the document contains a rendered marker. Protected calls, context and outbound private payloads continue through the existing document-bound host.

P/M/G rewrites require the rendered source and document target to match the current DocumentSession. Put in doc uses the same owner's current target. A live editor performs the edit through its existing writer; preview writes use the existing bounded ACK/canonical-read and recovery mechanism. Pending, denied, stale-target and recovery states refuse another write. No second Yjs provider is created.

Two source fixtures cover duplicate marker occurrence, stale marker, invalid append, preview write confirmation and target/disposal rejection. Browser, Svelte/type, formatter and runtime claims remain pending at this source checkpoint. Side-by-side file parity is a subsequent change.
