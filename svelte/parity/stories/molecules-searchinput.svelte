<script lang="ts">
  import SearchInput from "../../lib/studio/SearchInput.svelte";

  let { story }: { story: string } = $props();

  let value = $state("");
</script>

{#if story === "default"}
  <div class="tw:w-72">
    <SearchInput bind:value placeholder="Search connections..." />
  </div>
{:else if story === "searching"}
  <div class="tw:w-72">
    <SearchInput
      value="slack"
      onChange={() => {}}
      placeholder="Search connections..."
      isSearching
    />
  </div>
{:else if story === "disabled"}
  <div class="tw:w-72">
    <SearchInput
      value=""
      onChange={() => {}}
      placeholder="Search connections..."
      disabled
    />
  </div>
{/if}
