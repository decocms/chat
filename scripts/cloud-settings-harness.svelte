<script lang="ts">
  import type { Readable } from "svelte/store";
  import CloudSettings from "../web/features/sandboxes/CloudSettings.svelte";
  import type { AgentsService } from "../web/features/agents/service";
  // Passes the props as AccountSettings does: getters that read one account store.
  let {
    view,
    agents,
  }: {
    view: Readable<{
      account: string;
      rooms: { id: string; title: string }[];
      revision: number;
    }>;
    agents: AgentsService;
  } = $props();
</script>

<CloudSettings
  {agents}
  account={$view.account}
  rooms={$view.rooms}
  room={null}
  lang="en"
/>
