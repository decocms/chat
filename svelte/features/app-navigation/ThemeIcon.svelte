<script lang="ts">
  import Icon from "../../lib/ui/Icon.svelte";
  /** The vanilla app's icons: contrast for "follow the system", sun, moon. */
  let { theme }: { theme: "auto" | "light" | "dark" } = $props();
</script>

{#if theme === "light"}<Icon
    name="sun"
    class="tw:size-4"
  />{:else if theme === "dark"}<Icon name="moon" class="tw:size-4" />{:else}<svg
    aria-hidden="true"
    focusable="false"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
    stroke-linejoin="round"
    class="tw:size-4 tw:shrink-0"
    ><circle cx="12" cy="12" r="9" /><path
      d="M12 17a5 5 0 0 0 0-10z"
      fill="currentColor"
    /></svg
  >{/if}
