<script lang="ts">
  import Icon from "../../lib/studio/Icon.svelte";
  import { Contrast01, Moon01, Sun } from "../../lib/studio/icons";
  /** Contrast for "follow the system", sun, moon. */
  let { theme }: { theme: "auto" | "light" | "dark" } = $props();
</script>

<Icon
  icon={theme === "light" ? Sun : theme === "dark" ? Moon01 : Contrast01}
  class="size-4 shrink-0"
/>
