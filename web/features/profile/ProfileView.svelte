<script lang="ts">
  import type { ProfileResult } from "../../../shared/schemas";
  import { compact, rank, titleFor, type Axis } from "../../../shared/titles";
  import Avatar from "../../lib/studio/Avatar.svelte";
  import Badge from "../../lib/studio/Badge.svelte";
  import Card from "../../lib/studio/Card.svelte";
  import Progress from "../../lib/studio/Progress.svelte";
  import { profileText, type ProfileCopyKey, type ProfileLang } from "./copy";

  /** A person's whole profile (Gui #3526): the headline title, one card per axis with the way to its next tier, the
   *  last 30 days of tokens and the plan's limits. */
  let { profile, lang }: { profile: ProfileResult; lang: ProfileLang } =
    $props();
  const text = (key: ProfileCopyKey, vars?: Record<string, string>) =>
    profileText(lang, key, vars);
  const ranked = $derived(titleFor(profile.totals, lang));
  const MARK: Record<Axis, string> = {
    tokens: "✻",
    deploys: "🚀",
    messages: "💬",
    limits: "⚡",
  };
  const days = $derived(profile.days.map((d) => d.tokens));
  const max = $derived(Math.max(...days, 1));
  const locale = $derived(lang === "en" ? "en-US" : "pt-BR");
  const date = (ms: number) =>
    new Date(ms).toLocaleDateString(locale, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  const when = (s: number) =>
    new Date(s * 1000).toLocaleString(locale, {
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  const limitRows = $derived(
    (["five_hour", "seven_day"] as const).flatMap((k) => {
      const l = profile.limits?.[k];
      return l
        ? [
            {
              key: k,
              label: text(k === "five_hour" ? "fiveHour" : "sevenDay"),
              ...l,
            },
          ]
        : [];
    }),
  );
</script>

<div class="mx-auto flex w-full max-w-4xl flex-col gap-4 p-4 md:p-8">
  <Card
    class="relative flex flex-col items-center gap-3 overflow-hidden p-6 text-center md:flex-row md:items-center md:gap-6 md:p-8 md:text-left"
  >
    <span
      aria-hidden="true"
      class="pointer-events-none absolute -top-24 -right-24 size-64 rounded-full bg-brand-purple/15 blur-3xl"
    ></span>
    <Avatar
      shape="circle"
      size="2xl"
      url={profile.avatar ?? undefined}
      fallback={profile.name}
      class="ring-4 ring-brand-purple/30"
    />
    <div class="relative flex min-w-0 flex-col gap-1">
      <p class="m-0 text-sm text-muted-foreground">{profile.name}</p>
      <h1
        data-profile-title
        class="m-0 text-3xl font-semibold leading-tight tracking-tight md:text-4xl"
      >
        {ranked.title}
      </h1>
      <p class="m-0 text-xs text-muted-foreground">
        @{profile.handle} · {text("since", { date: date(profile.since) })}
      </p>
      <div class="mt-2 flex flex-wrap justify-center gap-1 md:justify-start">
        {#each ranked.ranks as r (r.axis)}<Badge
            variant={r.tier >= 5 ? "agent" : r.tier >= 2 ? "lime" : "muted"}
            >{MARK[r.axis]} {r.tierName}</Badge
          >{/each}
      </div>
    </div>
  </Card>

  <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
    {#each ranked.ranks as r (r.axis)}
      {@const next = r.next === null ? null : rank(r.axis, r.next, lang)}
      <Card data-axis={r.axis} class="flex flex-col gap-2 p-4">
        <span class="text-xs text-muted-foreground"
          >{MARK[r.axis]} {text(r.axis)}</span
        >
        <span class="text-2xl font-semibold tabular-nums"
          >{compact(r.value)}</span
        >
        <span class="text-sm font-medium">{r.tierName}</span>
        <Progress value={r.progress * 100} class="h-1" />
        <span class="text-[0.6875rem] leading-4 text-muted-foreground"
          >{next
            ? text("next", {
                left: compact(Math.max(0, (r.next ?? 0) - r.value)),
                tier: next.tierName,
              })
            : text("top")}</span
        >
      </Card>
    {/each}
  </div>

  <div class="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
    <Card class="flex flex-col gap-3 p-4">
      <span class="text-sm font-medium">{text("last30")}</span>
      <div class="flex min-h-32 flex-1 items-end gap-0.5" aria-hidden="true">
        {#each days as v, i (i)}
          <!-- An svg box takes its height from an attribute, where a div would need an inline style. -->
          <svg
            class="w-0 min-w-0 flex-1 rounded-t-sm {v
              ? 'bg-brand-purple'
              : 'bg-muted'}"
            height={`${Math.max(3, (v / max) * 100)}%`}
          ></svg>
        {/each}
      </div>
      <div class="flex justify-between text-[0.6875rem] text-muted-foreground">
        <span>{profile.days[0]?.day.slice(5)}</span>
        <span class="tabular-nums"
          >{compact(days.reduce((a, b) => a + b, 0))}</span
        >
        <span>{profile.days.at(-1)?.day.slice(5)}</span>
      </div>
    </Card>
    <Card data-limits class="flex flex-col gap-3 p-4">
      <span class="text-sm font-medium">{text("limitsNow")}</span>
      {#each limitRows as l (l.key)}
        <div class="flex flex-col gap-1">
          <div class="flex justify-between text-xs">
            <span>{l.label}</span><span class="tabular-nums font-medium"
              >{l.p}%</span
            >
          </div>
          <Progress
            value={l.p}
            tone={l.p >= 80 ? "warning" : "default"}
            class="h-1.5"
          />
          <span class="text-[0.6875rem] text-muted-foreground"
            >{text("resets", { when: when(l.r) })}</span
          >
        </div>
      {:else}<p class="m-0 text-xs text-muted-foreground">
          {text("noLimits")}
        </p>{/each}
      <span class="mt-1 text-xs font-medium">{text("hits")}</span>
      {#each profile.hits as h (h.kind + h.at)}<span
          class="text-xs text-muted-foreground"
          >⚡ {text(h.kind === "five_hour" ? "fiveHour" : "sevenDay")} · {date(
            h.at,
          )}</span
        >{:else}<span class="text-xs text-muted-foreground"
          >{text("noHits")}</span
        >{/each}
    </Card>
  </div>
  <p class="m-0 text-center text-[0.6875rem] text-muted-foreground">
    {text("how")}
  </p>
</div>
