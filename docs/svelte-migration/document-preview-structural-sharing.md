# Document App projection: bounded structural sharing

`documentAppNodes` previously cloned every child-bearing rich node even when the document contained no legal App paragraph. It now returns the existing sanitized tree when there are no markers, and otherwise copies only the path to a paragraph receiving an App slot. The returned root is explicitly readonly. No cache, parser, sanitizer, authority check, renderer, App key, task placement or source-span rule changes.

The consumer audit found reads in DocumentPreview/RichNodes and copy-on-transform behavior in documentBlocks. These projections do not mutate the shared input. Two regressions use actual parsed, recursively frozen trees: App-free prose preserves formatting, literal markers and sanitizer exclusions while placing tasks; a nested legal marker produces the same slot without modifying its source projection, and a later source replacement removes the slot without retaining stale content.

This change removes a concrete duplicate tree, but its byte/heap impact is unmeasured. It does not establish performance acceptance or address the entire retained-heap gap. The separate proposal to discard retained parse5 trees remains inactive.

Author verification: Node formatting passed for the three owned paths. The existing native-documents and rich-text suites, including the two new cases, passed 55 tests / 342 assertions in 8.19s under Bun 1.4.4. Strict types, actual Svelte DOM and browser checks remain pending; no compiler, build or browser was run locally.
