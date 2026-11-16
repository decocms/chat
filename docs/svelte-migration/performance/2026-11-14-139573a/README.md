# Performance evidence at 139573a

Source and tested revision: `139573ac8437d9a39b054e8f6687ae6bd8e8d591`.
GitHub Actions run: https://github.com/decocms/chat/actions/runs/43632725243.

All 32 original workload trials completed. Performance acceptance failed:
11 of the 16 device/metric budgets exceeded the unchanged limits. The original
report's `Status: passed` describes workload execution, not acceptance. The
workflow correctly failed. This evidence does not close M7 or authorize promotion.

Three of four separately excluded diagnostic trials passed. The native mobile
entry diagnostic rejected its CPU profile; its raw profile was discarded by the
existing validation policy, so the exact rejection reason cannot be recovered.

The six original artifact files are retained without content edits. Large JSON
files use gzip; decompression restores the exact original bytes. `provenance.json`
records source artifact names, run ID, original and stored sizes, and SHA-256
hashes. The module metadata supports attribution, not an alternative acceptance
measurement. No trials or budgets were removed or changed.
