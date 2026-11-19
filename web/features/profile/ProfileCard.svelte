<script lang="ts">
  import type { ProfileResult } from "../../../shared/schemas";
  import { compact, titleFor } from "../../../shared/titles";
  import Progress from "../../lib/studio/Progress.svelte";
  import { profileText, type ProfileLang } from "./copy";

  /** The hover card on a person: the headline title, the four numbers and a link to the whole profile. */
  let { profile, lang }: { profile: ProfileResult; lang: ProfileLang } =
    $props();
  const ranked = $derived(titleFor(profile.totals, lang));
</script>

<div data-profile-card class="flex flex-col gap-2">
  <div class="flex flex-col">
    <span class="text-[0.6875rem] text-muted-foreground">{profile.name}</span>
    <span class="text-sm font-semibold leading-5">{ranked.title}</span>
  </div>
  <Progress value={ranked.best.progress * 100} class="h-1" />
  <div class="grid grid-cols-4 gap-1 text-center">
    {#each ranked.ranks as r (r.axis)}<div class="flex flex-col">
        <span class="text-sm font-semibold tabular-nums"
          >{compact(r.value)}</span
        >
        <span class="truncate text-[0.625rem] text-muted-foreground"
          >{profileText(lang, r.axis)}</span
        >
      </div>{/each}
  </div>
  <a
    href={`/u/${profile.handle}`}
    class="cursor-pointer text-xs font-medium text-link no-underline hover:underline"
    >{profileText(lang, "open")} →</a
  >
</div>
