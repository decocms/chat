<script lang="ts">
  import type { Snippet } from "svelte";
  import HoverCard from "../../lib/components/HoverCard.svelte";
  import { fetchProfile } from "./api";
  import type { ProfileLang } from "./copy";
  import ProfileCard from "./ProfileCard.svelte";

  /** Hover (or tap) a person to see their title and stats. The profile loads only when the card opens. */
  let {
    email,
    lang,
    children,
  }: { email: string; lang: ProfileLang; children: Snippet } = $props();
</script>

<HoverCard side="right">
  {#snippet trigger(props)}<span
      {...props}
      data-person-hover
      class="inline-flex cursor-pointer rounded-full focus-visible:outline-2 focus-visible:outline-ring"
      >{@render children()}</span
    >{/snippet}
  {#await fetchProfile(email)}<span class="text-muted-foreground">…</span
    >{:then p}{#if p}<ProfileCard profile={p} {lang} />{/if}{/await}
</HoverCard>
