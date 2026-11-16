<script lang="ts">
  import { onDestroy } from "svelte";
  import Switch from "../../lib/studio/Switch.svelte";
  import { uiNavigationUrl } from "../../../shared/uiVariant";
  let { lang }: { lang: "pt" | "en" } = $props();
  let active = true;
  let control = $state<HTMLButtonElement | null>(null);
  onDestroy(() => {
    active = false;
  });
</script>

<label class="tw:inline-flex tw:min-h-11 tw:items-center tw:gap-2 tw:text-sm">
  <Switch
    data-ui-switch
    bind:ref={control}
    bind:checked={
      () => true,
      () => {
        if (!active || !control?.isConnected) return;
        window.location.assign(
          uiNavigationUrl(
            window.location.href,
            window.location.href,
            "vanilla",
          ),
        );
      }
    }
    aria-label={lang === "en" ? "New UI" : "Nova UI"}
  />
  {lang === "en" ? "New UI" : "Nova UI"}
</label>
