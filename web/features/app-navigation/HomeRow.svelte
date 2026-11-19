<script lang="ts">
  import Count from "../../lib/components/Count.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import type { NavRowVariant } from "../../lib/components/navRow";
  import { homeText, type HomeLanguage } from "../home/copy";
  import RoomRow from "./RoomRow.svelte";
  /** Home ("Início") as a row, with how many things wait on you. */
  let {
    selected,
    waits,
    lang,
    variant = "sidebar",
    onhome,
  }: {
    selected: boolean;
    waits: number;
    lang: HomeLanguage;
    variant?: NavRowVariant;
    onhome: () => void;
  } = $props();
</script>

<RoomRow
  href="/"
  label={homeText(lang, "startTitle")}
  {selected}
  {variant}
  onopen={onhome}
>
  <!-- The sidebar: a small icon, like a room's Main thread row. The phone's room list: the tile, as tall as a room's avatar. -->
  {#snippet leading()}{#if variant === "sidebar"}<Icon
        icon="home-02"
        size={16}
        class="shrink-0 text-muted-foreground"
      />{:else}<span
        class="grid size-9 shrink-0 place-items-center rounded-[0.6875rem] bg-muted"
        ><Icon icon="home-02" /></span
      >{/if}{/snippet}
  {#snippet trailing()}{#if waits}<Count
        value={waits}
        label={homeText(lang, "waiting", { n: waits })}
      />{/if}{/snippet}
</RoomRow>
