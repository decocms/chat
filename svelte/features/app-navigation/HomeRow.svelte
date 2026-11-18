<script lang="ts">
  import Count from "../../lib/components/Count.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import { Home02 } from "../../lib/studio/icons";
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
  href="/app?ui=svelte"
  label={homeText(lang, "startTitle")}
  {selected}
  {variant}
  onopen={onhome}
>
  {#snippet leading()}<span
      class="grid size-9 shrink-0 place-items-center rounded-[0.6875rem] bg-muted"
      ><Icon icon={Home02} /></span
    >{/snippet}
  {#snippet trailing()}{#if waits}<Count
        value={waits}
        label={homeText(lang, "waiting", { n: waits })}
      />{/if}{/snippet}
</RoomRow>
