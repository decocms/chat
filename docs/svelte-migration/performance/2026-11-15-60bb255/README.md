# Semantic-parser and geometry candidate

Exact source and served revision: `60bb255a9941489ff20f664a7a1bb8a464001c93`.
This isolated candidate combines the reviewed geometry snapshot and semantic
Markdown path with independently captured diagnostic heap summaries. It is not
deployed. Fresh builds, all 24 mandatory gates and generated asset freshness
passed before the original benchmark ran on BugMachine. The task-owned lane was
serialized; ambient host agents remain, so this is not dedicated hardware-lab
evidence.

All 32 original trials pass: 28 measured and four warmups, alternating variants,
seven measured trials per device/variant at 4x CPU and original Studio fonts.
Performance acceptance fails **12 of 16 unchanged budgets**. Second and third
history loads pass on both devices. Readiness, thread switching, first history,
application gzip, fonts and post-GC heap fail on both devices. The original
report and JSON retain every trial and comparison.

Application gzip is 330791 B versus the same 220643 B limit. That is 27536 B
less requested application code than the separate deployed-source control's
358327 B; it is not evidence of a framework-only latency gain. Mobile/desktop
readiness medians are 2796.2/2775.5 ms and thread medians are 986.5/953.7 ms.
Thread medians are worse than the control's 903.6/800.3 ms; the two cohorts do
not isolate a cause or establish statistical significance. Heap remains
20845232/20699340 B against 15428680/15423916 B limits. Fonts remain 826876 B;
the font-budget proposal is inactive.

Two of four excluded diagnostics pass. Both native CPU profiles still reject
negative deltas. Independent sanitized initial heap summaries were collected
despite those CPU failures; these do not repair CPU validity and are not the
accepted performance heap measurements. No raw heap or private strings are
retained here. No original trial, canonical readiness condition or budget changed.

Five original files are retained with exact hashes and lossless gzip. The
private runner supplied TEST_APP_REVISION after builds, so original module
metadata is unrecorded and remains rejected. A [separate frozen-SHA metadata
recovery](../2026-11-15-module-recovery/README.md) passes strict revision and
observed-asset hash checks against these unchanged original measurements. It
shows parse5 is absent from the candidate's observed entry requests. The
original metadata is not relabelled, and no acceptance result is overwritten.

Vanilla remains default. Further ordinary-message and chat-App experiments
remain isolated and unmeasured; this candidate is not accepted as the completed
migration or as a latency improvement.
