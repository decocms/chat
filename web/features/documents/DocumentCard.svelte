<script lang="ts">
  import type { Snippet } from "svelte";
  import type { Room } from "../../../shared/room";
  import type { RichActions } from "../rich-text/types";
  import CardView from "../chat-interactive/CardView.svelte";
  import { cardView } from "../chat-interactive/model";
  let {
    source,
    room,
    actions,
    t,
    fallback,
  }: {
    source: string;
    room: Room;
    actions: RichActions & {
      openApp?(target: { connection: string; tool: string }): void;
    };
    t: (text: string, vars?: Record<string, string | number>) => string;
    fallback: Snippet;
  } = $props();
  const card = $derived(cardView(source, room.id));
</script>

{#if card}<CardView
    {card}
    {room}
    {actions}
    vb={{ t }}
    readOnly
  />{:else}{@render fallback()}{/if}
