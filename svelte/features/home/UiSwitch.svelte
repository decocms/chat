<script lang="ts">
  import { onDestroy } from "svelte";
  import { uiNavigationUrl } from "../../../shared/uiVariant";
  let { lang }: { lang: "pt" | "en" } = $props();
  let active = true;
  onDestroy(() => {
    active = false;
  });
</script>

<label class="tw:inline-flex tw:min-h-11 tw:items-center tw:gap-2 tw:text-sm">
  <input
    data-ui-switch
    type="checkbox"
    role="switch"
    checked
    aria-label={lang === "en" ? "New UI" : "Nova UI"}
    class="tw:size-4 tw:accent-primary"
    onchange={(event) => {
      if (!active || !event.currentTarget.isConnected) return;
      window.location.assign(
        uiNavigationUrl(window.location.href, window.location.href, "vanilla"),
      );
    }}
  />
  {lang === "en" ? "New UI" : "Nova UI"}
</label>
