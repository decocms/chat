<script lang="ts">
  import Icon from "../../lib/studio/Icon.svelte";
  /** Contrast for "follow the system", sun, moon. */
  let { theme }: { theme: "auto" | "light" | "dark" } = $props();
</script>

<Icon
  icon={theme === "light"
    ? "sun"
    : theme === "dark"
      ? "moon-01"
      : "contrast-01"}
  class="size-4 shrink-0"
/>
