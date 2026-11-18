<script lang="ts">
  import { onDestroy } from "svelte";
  import Switch from "../../lib/studio/Switch.svelte";
  import { uiSwitchUrl } from "../../../shared/uiVariant";
  /** row: a settings row (the label first, the switch at the end), instead of switch-then-label. */
  let { lang, row = false }: { lang: "pt" | "en"; row?: boolean } = $props();
  let active = true;
  let control = $state<HTMLButtonElement | null>(null);
  onDestroy(() => {
    active = false;
  });
</script>

<label
  class={row
    ? "flex w-full cursor-pointer flex-row-reverse items-center justify-between gap-4 text-sm"
    : "inline-flex min-h-11 items-center gap-2 text-sm"}
>
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
