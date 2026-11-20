<script lang="ts">
  import { MOBILE_QUERY } from "../../lib/breakpoints";
  import { MediaQuery } from "svelte/reactivity";
  import type { Presence } from "./model";
  import {
    agentRows,
    contextPercent,
    contextSections,
    contextTone,
    roomListenerCount,
  } from "./model";
  import { prettyModel } from "../chat/model";
  import AgentMark from "../../lib/components/AgentMark.svelte";
  import HoverCard from "../../lib/components/HoverCard.svelte";
  import { agentProvider } from "../../lib/components/agent";
  import Progress from "../../lib/studio/Progress.svelte";
  import Badge from "../../lib/studio/Badge.svelte";
  import { cn } from "../../lib/studio/utils";
  let {
    presence,
    self = false,
    email,
    t,
    name,
    ago,
    locale = "pt-BR",
    surface = "sidebar",
    large = false,
  }: {
    presence: Presence;
    self?: boolean;
    email: string;
    t: (text: string, vars?: Record<string, string | number>) => string;
    name: (email: string) => string;
    ago: (ts: number) => string;
    locale?: string;
    /** The surface the rows sit on: sets the status dot's ring and the row hover tint. */
    surface?: "sidebar" | "background";
    /** The members pane: rows sized to sit under its 32px faces, lined up with the name. */
    large?: boolean;
  } = $props();
  const listeners = $derived(self ? roomListenerCount(presence, email) : 0);
  const rows = $derived(agentRows(presence, email));
  // The Studio bar paints its current color: green, yellow from 60%, red from 80%.
  const METERS = {
    hot: "[&_progress]:text-destructive",
    mid: "[&_progress]:text-warning",
    ok: "[&_progress]:text-brand",
  } as const;
  const SURFACES = {
    sidebar: { ring: "ring-sidebar", hover: "hover:bg-sidebar-accent" },
    background: { ring: "ring-background", hover: "hover:bg-accent" },
  } as const;
  const tone = $derived(SURFACES[surface]);
  const meter = (percent: number) => METERS[contextTone(percent)];
  const model = (who: string) => prettyModel(who) || "Agent";
  /** Beside the row on a wide sidebar; above it in the phone sheet, where there is no room to the right. */
  const narrow = new MediaQuery(MOBILE_QUERY);
</script>

{#if listeners > 1}<p
    data-duplicate-listeners
    role="status"
    class="m-0 ml-7 px-2 text-xs text-warning"
  >
    {t(
      "{n} Claudes seus ouvindo esta sala: cada um pode pegar o mesmo pedido. Feche os que sobram.",
      { n: listeners },
    )}
  </p>{/if}
{#each rows as agent}
  {@const percent = agent.context
    ? contextPercent(agent.context.tokens, agent.context.window)
    : null}
  {@const sections = contextSections(agent.context, t, locale)}
  {#snippet row(props: Record<string, unknown>)}
    <button
      {...props}
      type="button"
      data-agent-presence
      data-agent-provider={agentProvider(agent.who)}
      data-agent-listening={agent.listening}
      class={cn(
        "box-border flex cursor-default flex-col gap-1 rounded-lg border-0 bg-transparent px-2 py-1 text-left font-sans text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring",
        large
          ? "ml-9 w-[calc(100%-2.25rem)] py-1.5 text-sm"
          : "ml-7 w-[calc(100%-1.75rem)] text-xs",
        tone.hover,
      )}
    >
      <span class="flex w-full items-center gap-2">
        <span class="relative inline-flex shrink-0">
          <AgentMark
            size={large ? "xs" : "2xs"}
            tint
            via={agent.who}
            class={large ? "text-xs" : "text-[0.625rem]"}
          /><span
            data-status-dot={agent.listening ? "listening" : "idle"}
            class={cn(
              "absolute -right-0.5 -bottom-0.5 rounded-full ring-2",
              large ? "size-2.5" : "size-2",
              tone.ring,
              agent.listening ? "bg-brand" : "bg-muted-foreground",
            )}
          ></span>
        </span><span class="min-w-0 flex-1 truncate"
          >{model(agent.who).replace(/^Claude\s+/i, "")}{agent.repo
            ? ` · ${agent.repo}`
            : ""}{#if agent.role}
            <Badge size="sm" variant="neutral" data-agent-role={agent.role}
              >{agent.role}</Badge
            >{/if}</span
        ><span class="shrink-0"
          >{agent.listening
            ? t("ouvindo")
            : agent.seen_at === null
              ? "—"
              : ago(agent.seen_at)}{percent === null
            ? ""
            : ` · ${percent}%`}</span
        >
      </span>
      {#if percent !== null}<Progress
          data-context-bar
          aria-hidden="true"
          value={percent}
          class={cn(
            large
              ? "ml-8 h-1 w-[calc(100%-2rem)]"
              : "ml-6 h-[3px] w-[calc(100%-1.5rem)]",
            meter(percent),
          )}
        />{/if}
    </button>
  {/snippet}
  <HoverCard side={narrow.current ? "top" : "right"} trigger={row}>
    <div class="space-y-0.5">
      <p data-hover-title class="m-0 font-medium">
        {model(agent.who)} · {name(email)}
      </p>
      <p class="m-0 text-muted-foreground">
        {agent.repo ? `${agent.repo} · ` : ""}{agent.listening
          ? t(
              agent.all_rooms
                ? "ouvindo todas as salas agora"
                : "ouvindo esta sala agora",
            )
          : agent.seen_at === null
            ? t("não ouvindo")
            : t("visto há {ago}", { ago: ago(agent.seen_at) })}
      </p>
    </div>
    {#each sections as section (section.key)}<div
        data-hover-section={section.key}
        class="space-y-1"
      >
        <p class="m-0 flex justify-between gap-2">
          <span class="font-medium">{section.label}</span><span
            class="whitespace-nowrap text-muted-foreground"
            >{section.detail}</span
          >
        </p>
        <Progress
          value={section.percent}
          aria-label={section.label}
          class={meter(section.percent)}
        />
      </div>{/each}
  </HoverCard>
{/each}
