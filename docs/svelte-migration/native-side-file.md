# Native beside-chat files

Main parity baseline: 914d399. HTML attachment cards have distinct Open-beside and fullscreen actions. While the same exact room/file-name is open beside chat, cards retain a compact filename/open-beside row and the separate fullscreen action. Existing chat App iframes remain the same nonce-bound document host; hiding a preview does not grant another document authority.

A scoped side-file owner composes the existing bounded FileViewer read/index/version owner in embedded mode. Embedded mode does not push, replace, consume or traverse Viewer history. The pane reuses native file preview content for HTML/PDF/Markdown/text/image and the existing full raw download/truncation behavior. The fullscreen action uses the separate existing Viewer and its history handling.

The side selection follows newest canonical metadata with the same exact name until a historical version is selected. RootRoom remains the only reducer: validated, person-targeted Book `openSide` events insert missing exact metadata without replacing an existing version, then invoke the scoped pane action. No new personal-channel event or author is invented. Fire can use the metadata-only SideFileInput and currentSideFile target; unknown full metadata is reconciled by the existing file-index/probe path.

Source fixtures cover newest/historical following, no Viewer history changes, stale/reentrant close, authority loss, and real SideFilePanel DOM controls/fullscreen separation. Formatter, test execution and browser acceptance for this slice are pending at the initial source checkpoint.

Author receipt: Node Prettier on 16 owned paths passed; existing viewer + RoomStore pure suites passed 33 tests / 181 assertions in 3.27s. The new DOM case is source only and was not run locally. Metadata-only Fire output is tested arriving before its exact canonical file metadata, with no invented author and no write retry.
