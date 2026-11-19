<script lang="ts">
  import type { Writable } from "svelte/store";
  import type { Message, Room } from "../shared/room";
  import type { ChatActions, ChatBridge } from "../web/app/chatTypes";
  import DeferredInteractiveBody from "../web/features/chat-interactive/DeferredInteractiveBody.svelte";
  import type InteractiveBody from "../web/features/chat-interactive/InteractiveBody.svelte";
  let {
    state,
    actions,
    vb,
    load,
  }: {
    state: Writable<{ room: Room; message: Message }>;
    actions: ChatActions;
    vb: ChatBridge;
    load: () => Promise<typeof InteractiveBody>;
  } = $props();
</script>

<DeferredInteractiveBody
  room={$state.room}
  message={$state.message}
  {actions}
  {vb}
  {load}
/>
