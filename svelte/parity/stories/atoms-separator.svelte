<script lang="ts">
  import Separator from "../../lib/studio/Separator.svelte";

  let { story }: { story: string } = $props();
</script>

<!-- Studio's root line height, which the parity page does not inherit. -->
<div class="tw:leading-[1.5]">
  {#if story === "default"}
    <div class="tw:w-80">
      <div class="tw:space-y-1">
        <h4 class="tw:text-sm tw:font-medium tw:text-balance">
          Organization settings
        </h4>
        <p class="tw:text-sm tw:text-pretty tw:text-muted-foreground">
          Manage members, billing, and connections.
        </p>
      </div>
      <Separator class="tw:my-4" />
      <div class="tw:flex tw:h-5 tw:items-center tw:gap-4 tw:text-sm">
        <span>Members</span>
        <Separator orientation="vertical" />
        <span>Billing</span>
        <Separator orientation="vertical" />
        <span>Connections</span>
      </div>
    </div>
  {:else if story === "vertical"}
    <div class="tw:flex tw:h-8 tw:items-center tw:gap-4 tw:text-sm">
      <span>12 projects</span>
      <Separator orientation="vertical" />
      <span>4 members</span>
      <Separator orientation="vertical" />
      <span>8 connections</span>
    </div>
  {/if}
</div>
