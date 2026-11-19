<script lang="ts">
  import type { ProfileResult } from "../../../shared/schemas";
  import { compact, titleFor, type Axis } from "../../../shared/titles";
  import Avatar from "../../lib/studio/Avatar.svelte";
  import Progress from "../../lib/studio/Progress.svelte";
  import { profileText, type ProfileLang } from "./copy";

  /** A person's card, opened by clicking their avatar (Valls/Gui #3556): a holographic trading card with the
   *  headline title, one badge per axis (its tier and number) and a link to the whole profile. The foil sweeps and the
   *  card tilts on hover; with reduced motion it stays still. */
  let { profile, lang }: { profile: ProfileResult; lang: ProfileLang } =
    $props();
  const ranked = $derived(titleFor(profile.totals, lang));
  const MARK: Record<Axis, string> = {
    tokens: "✻",
    deploys: "🚀",
    messages: "💬",
    limits: "⚡",
  };
</script>

<div
  data-profile-card
  class="group relative isolate overflow-hidden rounded-2xl bg-[linear-gradient(160deg,var(--color-holo-from),var(--color-holo-to))] p-4 text-holo-foreground shadow-[0_18px_40px_-12px_var(--color-holo-shadow)] ring-1 ring-holo-line transition-transform duration-500 ease-out hover:[transform:perspective(700px)_rotateX(5deg)_rotateY(-7deg)] motion-reduce:transform-none!"
>
  <!-- Foil: a rainbow that sweeps across on hover, and a glare spot under it. -->
  <span
    aria-hidden="true"
    class="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(115deg,transparent_20%,var(--color-holo-foil-1)_35%,var(--color-holo-foil-2)_45%,var(--color-holo-foil-3)_55%,var(--color-holo-foil-4)_65%,transparent_80%)] bg-[length:250%_250%] bg-[position:0%_0%] opacity-60 mix-blend-color-dodge transition-[background-position,opacity] duration-1000 group-hover:bg-[position:100%_100%] group-hover:opacity-90 motion-reduce:opacity-40"
  ></span>
  <span
    aria-hidden="true"
    class="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_30%_20%,var(--color-holo-glare),transparent_45%)] opacity-0 transition-opacity group-hover:opacity-100"
  ></span>

  <div class="flex items-center gap-3">
    <Avatar
      shape="circle"
      size="lg"
      url={profile.avatar ?? undefined}
      fallback={profile.name}
      class="ring-2 ring-holo-muted"
    />
    <div class="flex min-w-0 flex-col">
      <span class="truncate text-[0.6875rem] text-holo-muted"
        >{profile.name}</span
      >
      <span
        data-profile-title
        class="text-base font-semibold leading-5 tracking-tight [text-shadow:0_0_12px_var(--color-holo-glow)]"
        >{ranked.title}</span
      >
      <span class="text-[0.625rem] text-holo-muted">@{profile.handle}</span>
    </div>
  </div>

  <div class="mt-3 grid grid-cols-2 gap-1.5">
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
    class="mt-3 inline-block cursor-pointer text-xs font-medium text-holo-tier no-underline hover:text-holo-foreground hover:underline"
    >{profileText(lang, "open")} →</a
  >
</div>
