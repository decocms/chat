# Isolated geometry experiment

Source `c29f9d2c40281bb480401f45ff4e556acaab03b4` batches room measurements before presentation writes, removes an unused eager width read and skips unchanged width/maximum state publication. It preserves synchronous initial measurement and all CSS playback. [Run 43671090339](https://github.com/vibegui/vibebook.dev/actions/runs/43671090339) passes its original source gates and production-layout browser test; both repository jobs fail only because generated assets were not refreshed yet. Original workflow failure remains recorded; refreshed assets require a new passing check.

Actual Chromium first-animation-frame root/viewport heights are both 923px. Page scale 1.5 changes only visualViewport with the same 1440px root width and 923px root height: the visible target becomes 589.6667px and the rendered viewport 589.65625px, then restores to923px. Existing slider/restored-width, mobile sheet/history/drag, retained Board and no-inline-style assertions pass with zero page errors. This is not a physical keyboard or first-paint raster test. Original report bytes and hash are retained.

No CPU/latency saving or budget acceptance is claimed. A clean main control and original complete performance cohort must establish the result before adoption. Studio fonts, styling rules and budgets are unchanged. This experiment is not deployed.
