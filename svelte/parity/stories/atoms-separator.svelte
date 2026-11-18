<script lang="ts">
  import Separator from "../../lib/studio/Separator.svelte";

  let { story }: { story: string } = $props();
</script>

<!-- Studio's root line height, which the parity page does not inherit. -->
<div class="leading-[1.5]">
  {#if story === "default"}
    <div class="w-80">
      <div class="space-y-1">
        <h4 class="text-sm font-medium text-balance">Organization settings</h4>
        <p class="text-sm text-pretty text-muted-foreground">
          Manage members, billing, and connections.
        </p>
      </div>
      <Separator class="my-4" />
      <div class="flex h-5 items-center gap-4 text-sm">
        <span>Members</span>
        <Separator orientation="vertical" />
        <span>Billing</span>
        <Separator orientation="vertical" />
        <span>Connections</span>
      </div>
    </div>
  {:else if story === "vertical"}
    <div class="flex h-8 items-center gap-4 text-sm">
      <span>12 projects</span>
      <Separator orientation="vertical" />
      <span>4 members</span>
      <Separator orientation="vertical" />
      <span>8 connections</span>
    </div>
  {/if}
</div>
