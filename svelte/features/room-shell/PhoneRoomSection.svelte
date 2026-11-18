<script lang="ts">
  import People from "../../People.svelte";
  import PinnedItems from "../pins/PinnedItems.svelte";
  import AgentPresenceRows from "../room-sidebar/AgentPresenceRows.svelte";
  import type { SidebarProps } from "../../sidebar";
  /**
   * On a phone the thread sheet keeps only threads and rooms: Pinned opens the
   * Files tab and People & agents closes the Claude tab. Same components and
   * props as the desktop sidebar.
   */
  let { part, sidebar }: { part: "pins" | "people"; sidebar: SidebarProps } =
    $props();
</script>

<div data-phone-room-section={part} class="tw:p-2">
  {#if part === "pins"}<PinnedItems
      room={sidebar.room}
      session={sidebar.pins}
      send={sidebar.send}
      request={sidebar.request}
      onopenfile={sidebar.onopenpinfile}
      onopenapp={sidebar.onopenpinapp}
      activeApp={sidebar.activePinApp}
      t={sidebar.vb.t}
    />{:else}
    {#snippet agents(email: string)}<AgentPresenceRows
        presence={sidebar.presence ?? { agents: [], sandboxes: [] }}
        self={email === sidebar.room.me}
        {email}
        t={sidebar.vb.t}
        name={sidebar.vb.name}
        ago={sidebar.vb.ago}
        locale={sidebar.locale}
      />{/snippet}
    <People
      room={sidebar.room}
      friends={sidebar.friends ?? []}
      vb={{
        t: sidebar.vb.t,
        name: sidebar.vb.name,
        ago: sidebar.vb.ago,
        avatarVersion: sidebar.vb.avatarVersion,
      }}
      {agents}
    />{/if}
</div>
