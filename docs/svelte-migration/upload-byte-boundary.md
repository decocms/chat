# Streamed upload limits

`src/requestBytes.ts` is the shared server-only raw-body reader for application
files, avatars, room icons and the existing speech adapter. Content-Length is
an early rejection only: every chunk is checked before copying or assembling
the complete body. A too-small or missing header cannot bypass the byte limit.
The reader cancels and releases its stream on success or failure. An oversized
declared length is canceled before reading. No storage mutation runs after a
size rejection.

| Operation | Limit | Rejection |
| --- | --- | --- |
| Room file | Existing `maxBytes(contentType)` | Oversize 413, empty/malformed length 400; existing `sizeError(type)` body |
| Avatar | 1,000,000 bytes | Existing 413 and localized error body |
| Room icon image | 256,000 bytes | Existing 400 and localized error body |
| Speech | Existing 4,000,000 bytes | Existing `SpeechAudioError` / 400 boundary |

File requests that omitted or understated Content-Length previously reached
storage's size check and returned 400. They now return 413 before storage, like
the declared-oversize case; the error body is unchanged. Native and vanilla
clients already handle either non-success status through that body. Valid
requests and membership/origin/rate checks retain their order and behavior.
The legacy JSON icon-removal request cancels its ignored body without buffering
it and still calls the existing authorized removal operation.

Actual Hono fixtures cover chunked and falsely small declared lengths, stop at
the second over-budget chunk without pulling a third, cancellation exactly once,
no storage calls, header-only rejection, and icon-removal compatibility.
Existing STT consumer/encoding cases remain separate. The combined RPC/connection
fixture run passes 40 tests / 442 assertions; isolated STT/authority tests pass
six tests / 37 assertions. Full compiler and browser checks must still validate
the integrated source; this receipt is not final M1/M2 acceptance.
