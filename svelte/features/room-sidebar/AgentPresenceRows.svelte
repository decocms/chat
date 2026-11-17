<script lang="ts">
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
  } = $props();
  const listeners = $derived(self ? roomListenerCount(presence, email) : 0);
  const rows = $derived(agentRows(presence, email));
  // The Studio bar paints its current color: green, yellow from 60%, red from 80%.
  const METERS = {
    hot: "tw:[&_progress]:text-destructive",
    mid: "tw:[&_progress]:text-warning",
    ok: "tw:[&_progress]:text-brand",
  } as const;
  const SURFACES = {
    sidebar: { ring: "tw:ring-sidebar", hover: "tw:hover:bg-sidebar-accent" },
    background: { ring: "tw:ring-background", hover: "tw:hover:bg-accent" },
  } as const;
  const tone = $derived(SURFACES[surface]);
  const meter = (percent: number) => METERS[contextTone(percent)];
  const model = (who: string) => prettyModel(who) || "Agent";
  /** Beside the row on a wide sidebar; above it in the phone sheet, where there is no room to the right. */
  const narrow = new MediaQuery("(max-width: 900px)");
</script>

{#if listeners > 1}<p
    data-duplicate-listeners
    role="status"
    class="tw:m-0 tw:ml-7 tw:px-2 tw:text-xs tw:text-warning"
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
        "tw:ml-7 tw:box-border tw:flex tw:w-[calc(100%-1.75rem)] tw:cursor-default tw:flex-col tw:gap-1 tw:rounded-lg tw:border-0 tw:bg-transparent tw:px-2 tw:py-1 tw:text-left tw:font-sans tw:text-xs tw:text-muted-foreground tw:focus-visible:outline-2 tw:focus-visible:outline-ring",
        tone.hover,
      )}
    >
      <span class="tw:flex tw:w-full tw:items-center tw:gap-2">
        <span class="tw:relative tw:inline-flex tw:shrink-0">
          <AgentMark
            size="2xs"
            tint
            via={agent.who}
            class="tw:text-[0.625rem]"
          /><span
            data-status-dot={agent.listening ? "listening" : "idle"}
            class={cn(
              "tw:absolute tw:-right-0.5 tw:-bottom-0.5 tw:size-2 tw:rounded-full tw:ring-2",
              tone.ring,
              agent.listening ? "tw:bg-brand" : "tw:bg-muted-foreground",
            )}
          ></span>
        </span><span class="tw:min-w-0 tw:flex-1 tw:truncate"
          >{model(agent.who).replace(/^Claude\s+/i, "")}{agent.repo
            ? ` · ${agent.repo}`
            : ""}</span
        ><span class="tw:shrink-0"
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
            "tw:ml-6 tw:h-[3px] tw:w-[calc(100%-1.5rem)]",
            meter(percent),
          )}
        />{/if}
    </button>
  {/snippet}
  <HoverCard side={narrow.current ? "top" : "right"} trigger={row}>
    <div class="tw:space-y-0.5">
      <p data-hover-title class="tw:m-0 tw:font-medium">
        {model(agent.who)} · {name(email)}
      </p>
      <p class="tw:m-0 tw:text-muted-foreground">
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
        class="tw:space-y-1"
      >
        <p class="tw:m-0 tw:flex tw:justify-between tw:gap-2">
          <span class="tw:font-medium">{section.label}</span><span
            class="tw:whitespace-nowrap tw:text-muted-foreground"
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
