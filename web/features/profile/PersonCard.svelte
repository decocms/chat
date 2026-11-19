<script lang="ts">
  import type { Snippet } from "svelte";
  import Popover from "../../lib/studio/Popover.svelte";
  import PopoverContent from "../../lib/studio/PopoverContent.svelte";
  import PopoverTrigger from "../../lib/studio/PopoverTrigger.svelte";
  import { fetchProfile } from "./api";
  import { profileText, type ProfileLang } from "./copy";
  import ProfileCard from "./ProfileCard.svelte";

  /** Click a person's avatar to open their holographic card: title, badges and stats. Loads only when opened. */
  let {
    email,
    lang,
    children,
  }: { email: string; lang: ProfileLang; children: Snippet } = $props();
  let open = $state(false);
</script>

<Popover bind:open>
  <PopoverTrigger>
    {#snippet child({ props })}<button
        {...props}
        type="button"
        aria-label={profileText(lang, "open")}
        data-person-card-trigger
        class="inline-flex cursor-pointer rounded-full border-0 bg-transparent p-0 focus-visible:outline-2 focus-visible:outline-ring"
        >{@render children()}</button
      >{/snippet}
  </PopoverTrigger>
  <PopoverContent
    side="right"
    align="start"
    sideOffset={8}
    class="w-72 max-w-[calc(100vw-16px)] border-0 bg-transparent p-0 shadow-none"
  >
    {#if open}{#await fetchProfile(email)}<div
          class="rounded-2xl bg-popover p-4 text-xs text-muted-foreground"
        >
          …
        </div>{:then p}{#if p}<ProfileCard
            profile={p}
            {lang}
          />{/if}{/await}{/if}
  </PopoverContent>
</Popover>
