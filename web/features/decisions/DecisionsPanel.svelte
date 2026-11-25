<script lang="ts">
  import { onDestroy, untrack } from "svelte";
  import type { Decision, PanelProps } from "../../app/panels";
  import type { IconName } from "../../lib/studio/icons";
  import {
    createDecisionsSession,
    decisionDays,
    decisionKind,
    type DecisionDay,
    type DecisionKind,
  } from "./model";
  import ConfirmDialog from "../../lib/components/ConfirmDialog.svelte";
  import AgentMark from "../../lib/components/AgentMark.svelte";
  import PersonAvatar from "../../lib/components/PersonAvatar.svelte";
  import IconButton from "../../lib/studio/IconButton.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import PaneEmpty from "../../lib/components/PaneEmpty.svelte";
  import PaneHeader from "../../lib/components/PaneHeader.svelte";
  import { paneIcons } from "../documents/paneIcons";
  let {
    room,
    vb,
    request,
    ask,
    onjump,
  }: Pick<PanelProps, "room" | "vb" | "request" | "ask" | "onjump"> = $props();
  const session = untrack(() => createDecisionsSession(room.id));
  const view = session.state;
  const list = $derived(room.decisions || []);
  const days = $derived(decisionDays(list));
  const clock = $derived(
    new Intl.DateTimeFormat(vb.locale, { hour: "numeric", minute: "2-digit" }),
  );
  const date = $derived(
    new Intl.DateTimeFormat(vb.locale, {
      weekday: "short",
      day: "numeric",
      month: "short",
    }),
  );
  const dateWithYear = $derived(
    new Intl.DateTimeFormat(vb.locale, {
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
  );
  function dayLabel(day: DecisionDay) {
    switch (day.when) {
      case "today":
        return vb.t("Hoje");
      case "yesterday":
        return vb.t("Ontem");
      case "date":
        return new Date(day.start).getFullYear() === new Date().getFullYear()
          ? date.format(day.start)
          : dateWithYear.format(day.start);
      default: {
        const never: never = day.when;
        return never;
      }
    }
  }
  /** Each kind's mark on the line, like a changelog's entry types. */
  function kindLook(kind: DecisionKind): {
    icon: IconName;
    label: string;
    tone: string;
  } {
    switch (kind) {
      case "decision":
        return { icon: "flag-01", label: "decidido", tone: "text-special" };
      case "approval":
        return { icon: "check", label: "aprovado", tone: "text-success" };
      default: {
        const never: never = kind;
        return never;
      }
    }
  }
  let deletion = $state<Decision | null>(null);
  let dialogOpen = $state(false);
  let deleteTrigger = $state<HTMLElement | null>(null);
  let panelRoot = $state<HTMLElement | null>(null);
  const issueText = (issue?: string) =>
    !issue
      ? ""
      : ["offline", "disconnected"].includes(issue)
        ? vb.t("sem conexão")
        : ["timeout", "unconfirmed"].includes(issue)
          ? vb.t(
              "Ainda não recebi a confirmação. Confira antes de tentar de novo.",
            )
          : issue;
  $effect(() => {
    session.sync(list);
    if (deletion && !list.some((d) => d.id === deletion!.id)) {
      dialogOpen = false;
      deletion = null;
    }
  });
  onDestroy(() => session.dispose());
</script>

{#snippet entry(decision: Decision)}
  <span class="block text-sm leading-5 whitespace-pre-wrap break-words">
    {decision.text}
  </span>
  <span
    class="mt-1 flex flex-wrap items-center gap-x-1 text-xs leading-4 text-muted-foreground"
  >
    <span>{vb.t(kindLook(decisionKind(decision.kind)).label)} ·</span>
    {#if decision.email}<span
        data-decision-avatar
        class="relative mr-0.5 inline-flex shrink-0"
        ><PersonAvatar
          data-avatar="person"
          size="2xs"
          class="size-4 shadow-[0_0_0_1.5px_var(--vb-background)]"
          email={decision.email}
          version={vb.avatarVersion(decision.email)}
        />{#if decision.via}<AgentMark
            size="3xs"
            tint
            via={decision.via}
            class="absolute -right-1 -bottom-1 rounded-full text-[7px] shadow-[0_0_0_1.5px_var(--vb-background)]"
          />{/if}</span
      ><span class="break-words"
        >{vb.name(decision.email)}{decision.via
          ? ` · ${vb.t("via agent")}`
          : ""} ·</span
      >{:else}<span class="break-words">{decision.who} ·</span>{/if}
    <time datetime={new Date(decision.ts).toISOString()}
      >{clock.format(decision.ts)}</time
    >
  </span>
  {#if $view.pending[decision.id]}<span
      role="status"
      class="block mt-1 text-xs text-muted-foreground"
    >
      {vb.t("Aguardando confirmação…")}
    </span>{/if}
  {#if $view.issues[decision.id]}<span
      role="alert"
      class="block mt-1 whitespace-pre-wrap break-words text-sm text-destructive"
    >
      {issueText($view.issues[decision.id])}
    </span>{/if}
{/snippet}

<section
  bind:this={panelRoot}
  tabindex="-1"
  data-decisions-panel
  class="p-4 font-sans text-sm text-foreground"
>
  <PaneHeader title={vb.t("Decisões")} count={list.length} />
  {#if days.length}
    <!-- One timeline: the line runs through every icon, from the first day to the last entry. -->
    <!-- Rounded rows inside the pane's inset. Each row draws its piece of the line, reaching 4px past
         its edges to bridge the gap; the line sits above a hovered row's fill and under the icon nodes. -->
    <ol data-decisions-timeline class="mt-2 mb-0 list-none p-0">
      {#each days as day, dayIndex (day.key)}
        <li data-decision-day={day.when}>
          <div
            class={[
              "relative grid grid-cols-[24px_1fr] gap-3 px-3 pb-2",
              dayIndex === 0 ? "pt-2" : "pt-6",
            ]}
          >
            <span
              aria-hidden="true"
              class={[
                "absolute left-6 z-[1] w-px -translate-x-1/2 bg-border",
                dayIndex === 0 ? "top-[18px] -bottom-1" : "inset-y-0 -bottom-1",
              ]}
            ></span>
            <span
              aria-hidden="true"
              class="relative z-[2] mx-auto mt-1.5 size-2 rounded-full bg-border"
            ></span>
            <h3 class="m-0 text-sm leading-5 font-medium text-muted-foreground">
              {dayLabel(day)}
            </h3>
          </div>
          <ol class="m-0 flex list-none flex-col gap-1 p-0">
            {#each day.items as decision, index (decision.id)}
              {@const look = kindLook(decisionKind(decision.kind))}
              {@const last =
                dayIndex === days.length - 1 && index === day.items.length - 1}
              <li>
                <article
                  data-decision-id={decision.id}
                  data-decision-kind={decisionKind(decision.kind)}
                  class="group relative grid grid-cols-[24px_1fr_auto] items-start gap-3 rounded-lg px-3 py-2.5 transition-colors duration-150 hover:bg-muted"
                >
                  <span
                    aria-hidden="true"
                    class={[
                      "absolute left-6 z-[1] w-px -translate-x-1/2 bg-border",
                      last ? "-top-1 h-[26px]" : "-inset-y-1",
                    ]}
                  ></span>
                  <span
                    class={[
                      "relative z-[2] grid size-6 place-items-center rounded-full border border-border bg-background",
                      look.tone,
                    ]}><Icon icon={look.icon} size={13} /></span
                  >
                  {#if decision.msg && onjump}
                    {@const msg = decision.msg}
                    <button
                      type="button"
                      data-decision-jump={msg}
                      class="min-w-0 cursor-pointer rounded-sm border-0 bg-transparent p-0 text-left font-sans text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      onclick={() => onjump(msg)}
                      >{@render entry(decision)}</button
                    >
                  {:else}
                    <div class="min-w-0">{@render entry(decision)}</div>
                  {/if}
                  <IconButton
                    class="-my-1 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 disabled:opacity-100 pointer-coarse:opacity-100"
                    data-ddel={decision.id}
                    label={vb.t("Apagar registro")}
                    disabled={!!$view.pending[decision.id]}
                    onclick={(event) => {
                      deletion = decision;
                      deleteTrigger = event.currentTarget;
                      dialogOpen = true;
                    }}><Icon icon="x" size={16} /></IconButton
                  >
                </article>
              </li>
            {/each}
          </ol>
        </li>
      {/each}
    </ol>
  {:else}
    <PaneEmpty
      icon={paneIcons.decisions}
      title={vb.t("Nenhuma decisão ainda")}
      description={vb.t(
        "O que a sala decide e cada aprovação, com quem decidiu e quando, pra ninguém precisar caçar no chat.",
      )}
      ask={vb.t(
        "Lê a conversa desta sala e registra as decisões que a gente já tomou.",
      )}
      askLabel={vb.t("Peça pro seu Claude")}
      onask={ask}
    />
  {/if}
</section>
<ConfirmDialog
  bind:open={dialogOpen}
  title={vb.t("Apagar esse registro?")}
  description={deletion?.text}
  confirmLabel={vb.t("Apagar registro")}
  cancelLabel={vb.t("Cancelar")}
  busy={!!(deletion && $view.pending[deletion.id])}
  error={deletion ? issueText($view.issues[deletion.id]) : ""}
  onconfirm={() => {
    if (deletion) void session.remove(room.id, deletion.id, request);
  }}
  returnFocus={() => (deleteTrigger?.isConnected ? deleteTrigger : panelRoot)}
/>
