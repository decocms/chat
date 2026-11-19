<script lang="ts">
  import Count from "../../lib/components/Count.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import { homeText, type HomeLanguage } from "../home/copy";
  import RoomRow from "./RoomRow.svelte";
  /** Your Inbox for all rooms as a row under Home, with how many things wait on you. */
  let {
    selected,
    waits,
    lang,
    oninbox,
  }: {
    selected: boolean;
    waits: number;
    lang: HomeLanguage;
    oninbox: () => void;
  } = $props();
</script>

<RoomRow
  href="/?inbox"
  label={homeText(lang, "inbox")}
  {selected}
  onopen={oninbox}
>
  {#snippet leading()}<Icon
      icon="inbox-01"
      size={16}
      class="shrink-0 text-muted-foreground"
    />{/snippet}
  {#snippet trailing()}{#if waits}<Count
        value={waits}
        label={homeText(lang, "waiting", { n: waits })}
      />{/if}{/snippet}
</RoomRow>
