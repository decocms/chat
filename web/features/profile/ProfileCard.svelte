<script lang="ts">
  import type { ProfileResult } from "../../../shared/schemas";
  import { compact, titleFor, type Axis } from "../../../shared/titles";
  import Avatar from "../../lib/studio/Avatar.svelte";
  import Progress from "../../lib/studio/Progress.svelte";
  import { profileText, type ProfileLang } from "./copy";
  import { holo } from "./holo";

  /** A person's card, opened by clicking their avatar (Valls/Gui #3556): a holographic trading card ported from
   *  holocard (#3579) with the headline title, one badge per axis (tier and number) and a link to the profile. The
   *  foil, lines, sparkles and glare follow the pointer (the phone's tilt after a tap); reduced motion keeps it still. */
  let { profile, lang }: { profile: ProfileResult; lang: ProfileLang } =
    $props();
  const ranked = $derived(titleFor(profile.totals, lang));
  const MARK: Record<Axis, string> = {
    tokens: "✻",
    deploys: "🚀",
    messages: "💬",
    limits: "⚡",
  };
  const layer = "pointer-events-none absolute inset-0 z-10";
</script>

<div class="perspective-[1100px]">
  <div
    data-profile-card
    use:holo
    class="relative isolate flex aspect-[5/7] flex-col overflow-hidden rounded-3xl bg-[linear-gradient(160deg,var(--color-holo-from),var(--color-holo-to))] p-4 text-holo-foreground shadow-[0_30px_60px_-24px_var(--color-holo-shadow)] ring-1 ring-holo-line [--active:0] [--mx:50%] [--my:50%] [--posx:50%] [--posy:50%] [--rx:0deg] [--ry:0deg] [transform-style:preserve-3d] [transform:rotateX(var(--rx))_rotateY(var(--ry))] motion-reduce:[transform:none]"
  >
    <!-- Holocard's layers: foil masked around the light, fine lines, glare, sparkles. -->
    <span
      aria-hidden="true"
      class="{layer} bg-(image:--vb-holo-rainbow) bg-size-[260%_260%] bg-position-[var(--posx)_var(--posy)] opacity-[calc(.3+var(--active)*.6)] mix-blend-color-dodge [mask-image:radial-gradient(circle_at_var(--mx)_var(--my),black_0%,rgb(0_0_0/.33)_32%,transparent_62%)]"
    ></span>
    <span
      aria-hidden="true"
      class="{layer} bg-(image:--vb-holo-lines) bg-size-[200%_100%] bg-position-[var(--posx)_0] opacity-[calc(var(--active)*.24)] mix-blend-overlay motion-reduce:hidden"
    ></span>
    <span
      aria-hidden="true"
      class="{layer} bg-[radial-gradient(circle_at_var(--mx)_var(--my),var(--color-holo-glare),transparent_43%)] opacity-[calc(var(--active)*.9)] mix-blend-soft-light motion-reduce:hidden"
    ></span>
    <span
      aria-hidden="true"
      class="{layer} bg-(image:--vb-holo-sparkle) bg-size-[47px_61px,71px_53px,59px_79px] bg-position-[var(--posx)_var(--posy),calc(100%-var(--posx))_var(--posy),var(--posx)_calc(100%-var(--posy))] opacity-[calc(.1+var(--active)*.75)] mix-blend-color-dodge"
    ></span>

    <div class="relative flex flex-col items-center gap-1 pt-2 text-center">
      <Avatar
        shape="circle"
        size="2xl"
        url={profile.avatar ?? undefined}
        fallback={profile.name}
        class="ring-2 ring-holo-muted"
      />
      <span class="mt-2 truncate text-[0.6875rem] text-holo-muted"
        >{profile.name}</span
      >
      <span
        data-profile-title
        class="text-lg font-semibold leading-6 tracking-tight [text-shadow:0_0_12px_var(--color-holo-glow)]"
        >{ranked.title}</span
      >
      <span class="text-[0.625rem] text-holo-muted">@{profile.handle}</span>
    </div>

    <div class="relative mt-auto grid grid-cols-2 gap-1.5">
      {#each ranked.ranks as r (r.axis)}<div
          data-profile-badge={r.axis}
          class="flex min-w-0 flex-col rounded-lg bg-holo-line px-2 py-1.5 ring-1 ring-holo-line backdrop-blur-sm"
        >
          <span class="flex items-baseline justify-between gap-1">
            <span class="truncate text-[0.625rem] text-holo-muted"
              >{MARK[r.axis]} {profileText(lang, r.axis)}</span
            >
            <span class="text-sm font-semibold tabular-nums"
              >{compact(r.value)}</span
            >
          </span>
          <span class="truncate text-[0.6875rem] font-medium text-holo-tier"
            >{r.tierName}</span
          >
          <Progress value={r.progress * 100} class="mt-1 h-0.5 bg-holo-line" />
        </div>{/each}
    </div>

    <a
      href={`/u/${profile.handle}`}
      class="relative z-20 mt-3 inline-block cursor-pointer text-center text-xs font-medium text-holo-tier no-underline hover:text-holo-foreground hover:underline"
      >{profileText(lang, "open")} →</a
    >
  </div>
</div>
