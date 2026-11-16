<script lang="ts">
  import type { Presence } from "./model";
  import { agentRows, contextPercent, roomListenerCount } from "./model";
  import { prettyModel } from "../chat/model";
  import AgentAvatar from "../../lib/ui/AgentAvatar.svelte";
  import Progress from "../../lib/ui/Progress.svelte";
  let {
    presence,
    self = false,
    email,
    t,
    name,
    ago,
    locale = "pt-BR",
  }: {
    presence: Presence;
    self?: boolean;
    email: string;
    t: (text: string, vars?: Record<string, string | number>) => string;
    name: (email: string) => string;
    ago: (ts: number) => string;
    locale?: string;
  } = $props();
  const listeners = $derived(self ? roomListenerCount(presence, email) : 0);
  const rows = $derived(agentRows(presence, email));
  const meter = (percent: number) =>
    percent >= 80
      ? "tw:[&::-webkit-progress-value]:bg-destructive! tw:[&::-moz-progress-bar]:bg-destructive!"
      : percent >= 60
        ? "tw:[&::-webkit-progress-value]:bg-warning! tw:[&::-moz-progress-bar]:bg-warning!"
        : "tw:[&::-webkit-progress-value]:bg-success! tw:[&::-moz-progress-bar]:bg-success!";
  const tokens = (value: number) =>
    value >= 1e6
      ? `${+(value / 1e6).toFixed(1)}M`
      : `${Math.round(value / 1000)}k`;
</script>

{#if listeners > 1}<p
    data-duplicate-listeners
    role="status"
    class="tw:ml-5 tw:text-xs tw:text-warning"
  >
    {t(
      "{n} Claudes seus ouvindo esta sala: cada um pode pegar o mesmo pedido. Feche os que sobram.",
      { n: listeners },
    )}
  </p>{/if}
{#each rows as agent}
  <div
    data-agent-presence
    class="tw:ml-5 tw:space-y-1 tw:rounded-control tw:px-2 tw:py-1 tw:text-xs tw:text-muted-foreground"
    title={t("{via} de {who}", {
      via: prettyModel(agent.who),
      who: name(email),
    })}
  >
    <div class="tw:flex tw:items-center tw:gap-2">
      <AgentAvatar
        px={16}
        via={agent.who}
        class={agent.listening
          ? "tw:font-normal tw:text-success"
          : "tw:font-normal tw:text-muted-foreground"}
      /><span class="tw:min-w-0 tw:flex-1 tw:truncate"
        >{prettyModel(agent.who).replace(/^Claude\s+/i, "")}{agent.repo
          ? ` · ${agent.repo}`
          : ""}</span
      ><span
        >{agent.listening
          ? t(agent.all_rooms ? "ouvindo todas as salas agora" : "ouvindo")
          : agent.seen_at === null
            ? "—"
            : ago(agent.seen_at)}</span
      >
    </div>
    {#if agent.context}{@const context = agent.context}{@const percent =
        contextPercent(context.tokens, context.window)}
      <details class="tw:space-y-1">
        <summary
          class="tw:cursor-pointer tw:rounded-control tw:focus-visible:outline-2 tw:focus-visible:outline-ring"
          >{t("Contexto")}: {percent}% · {tokens(context.tokens)}/{tokens(
            context.window,
          )}</summary
        >
        <Progress
          value={percent}
          label={t("Contexto")}
          class={meter(percent)}
        />
        {#each ["five_hour", "seven_day"] as key}{@const limit =
            key === "five_hour"
              ? context.limits?.five_hour
              : context.limits?.seven_day}
          {#if limit && limit.r * 1000 >= Date.now()}<p class="tw:m-0">
              {t(key === "five_hour" ? "Sessão de 5h" : "Semana")}: {limit.p}% · {t(
                "reseta",
              )}
              {new Date(limit.r * 1000).toLocaleString(locale)}
            </p>
            <Progress
              value={limit.p}
              class={meter(limit.p)}
              label={t(key === "five_hour" ? "Sessão de 5h" : "Semana")}
            />{/if}
        {/each}
      </details>
    {/if}
  </div>
{/each}
