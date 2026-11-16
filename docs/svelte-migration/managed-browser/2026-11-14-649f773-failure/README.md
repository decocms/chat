# Retained real-Worker browser failure at 649f773

Exact source/tested revision: `649f77367198dc45db82ad29dc4f6864207fdb33`.
[Managed browser run](https://github.com/decocms/chat/actions/runs/43641405175)
failed after four passing phases, while asserting the actual R2 file contents in
the native Viewer (`native-application-browser.ts:998`). The phase timed out after
60,112ms; no page errors were recorded. The newly added twelve-profile audit was
not reached and has no passing evidence from this run.

Both original safe JSON files are retained unchanged:

- `results.json`: SHA-256 `13d0fd296fbc6b81a71d06f93dd6ca433310047cb8aa93f6c5b46a0b8f76105a`.
- `runner.json`: SHA-256 `6b64f455400abd0953835ff77e99eec8f44e78903031647abd5248bd139f8d4d`.

The source/build workflow separately passed all repository gates on Linux and
macOS, then failed checked-in preview freshness. Its exact retained build
artifacts supply the preview refresh; that is source/build evidence, not a cure
for this browser failure. Runtime range-response narrowing is being investigated.
Do not replace this failed result with the earlier passing cohort or claim tablet,
final-source, production or performance acceptance.
