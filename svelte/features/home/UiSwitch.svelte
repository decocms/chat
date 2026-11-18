<script lang="ts">
  import { onDestroy } from "svelte";
  import Switch from "../../lib/studio/Switch.svelte";
  import { uiSwitchUrl } from "../../../shared/uiVariant";
  let { lang }: { lang: "pt" | "en" } = $props();
  let active = true;
  let control = $state<HTMLButtonElement | null>(null);
  onDestroy(() => {
    active = false;
  });
</script>

<label class="inline-flex min-h-11 items-center gap-2 text-sm">
  <Switch
    data-ui-switch
    bind:ref={control}
    bind:checked={
      () => true,
      () => {
        if (!active || !control?.isConnected) return;
        window.location.assign(uiSwitchUrl("vanilla", window.location.href));
      }
    }
    aria-label={lang === "en" ? "New UI" : "Nova UI"}
  />
  {lang === "en" ? "New UI" : "Nova UI"}
</label>
