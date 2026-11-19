<script lang="ts">
  import PersonAvatar from "../../lib/components/PersonAvatar.svelte";
  import { onDestroy, untrack } from "svelte";
  import type { Room, Message, Poll } from "../../../shared/room";
  import type { ChatActions, ChatBridge } from "../../app/chatTypes";
  import { pollView, canClosePoll, pollIdentity } from "./model";
  import { createInteractiveSession, idleState } from "./session";
  import Button from "../../lib/studio/Button.svelte";
  import Progress from "../../lib/studio/Progress.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import { BarChartSquare02, Check, Trophy01 } from "../../lib/studio/icons";
  import ConfirmDialog from "../../lib/components/ConfirmDialog.svelte";
  let {
    poll,
    message,
    room,
    actions,
    vb,
  }: {
    poll: Poll;
    message: Message;
    room: Room;
    actions: ChatActions;
    vb: ChatBridge;
  } = $props();
  let active = true,
    status = $state(idleState()),
    closing = $state(false),
    focusTarget = $state<HTMLElement | null>(null),
    selectedIdentity = $state<string | undefined>();
  const identity = $derived(
    JSON.stringify([
      message.id,
      message.thread,
      message.poll,
      pollIdentity(poll),
    ]),
  );
  const session = untrack(() =>
    createInteractiveSession(
      room.id,
      message.id,
      (next) => (status = next),
      undefined,
      "poll",
    ),
  );
  const view = $derived(pollView(poll, room.me));
  const canClose = $derived(canClosePoll(room, poll));
  const canVote = $derived(!poll.closed && room.members.includes(room.me));
  $effect(() => {
    const snapshot = room;
    untrack(() => session.sync(snapshot));
  });
  $effect(() => {
    if (
      !canClose ||
      status.phase === "unconfirmed" ||
      (selectedIdentity !== undefined && selectedIdentity !== identity)
    )
      closing = false;
  });
  onDestroy(() => {
    active = false;
    session.dispose();
  });
  function vote(index: number, event: MouseEvent) {
    if (
      active &&
      event.currentTarget instanceof HTMLElement &&
      event.currentTarget.isConnected &&
      canVote
    )
      void session.vote(index, actions.request);
  }
  function close() {
    if (active && canClose && closing && selectedIdentity === identity)
      void session.close(actions.request);
  }
</script>

<section
  data-native-poll={poll.id}
  class="space-y-3 rounded-surface border border-border bg-card p-4 font-sans text-sm text-card-foreground"
>
  <h4
    class="m-0 flex items-start gap-2 font-sans text-sm font-semibold tracking-normal [font-variation-settings:normal]"
  >
    <Icon icon={BarChartSquare02} size={16} />{poll.question}
  </h4>
  {#each view.rows as row}<div class="space-y-1">
      <Button
        class="h-auto w-full justify-start whitespace-normal text-left"
        data-native-vote={row.index}
        variant={row.mine ? "secondary" : "outline"}
        disabled={!canVote ||
          status.phase === "pending" ||
          status.phase === "unconfirmed"}
        aria-pressed={row.mine}
        onclick={(event) => vote(row.index, event)}
        >{#if row.winner}<Icon
            icon={Trophy01}
            size={16}
          />{:else if row.mine}<Icon icon={Check} size={16} />{/if}<span
          class="min-w-0 flex-1 break-words">{row.label}</span
        ><span class="flex -space-x-2"
          >{#each row.voters as email}<span title={vb.name(email)}
              ><PersonAvatar
                data-avatar="person"
                size="xs"
                {email}
                version={vb.avatarVersion(email)}
                class="ring-2 ring-card"
              /></span
            >{/each}</span
        ><span class="shrink-0 text-xs"
          >{row.count ? `${row.percent}%` : ""}</span
        ></Button
      ><Progress
        value={row.percent}
        aria-label={`${row.label}: ${row.count} (${row.percent}%)`}
      />
    </div>{/each}
  <p
    class="m-0 flex flex-wrap items-center gap-1 text-xs text-muted-foreground"
  >
    {view.voters === 1
      ? vb.t("1 pessoa votou")
      : vb.t("{n} pessoas votaram", { n: view.voters })} · {poll.multi
      ? vb.t("pode escolher várias")
      : vb.t("escolha uma")}{#if poll.closed}
      · {vb.t("encerrada")}{:else if canClose}
      · <Button
        size="sm"
        variant="link"
        class="h-auto px-0 text-xs text-foreground underline decoration-current/35 underline-offset-4 hover:decoration-current"
        data-native-poll-close
        disabled={status.phase === "pending" || status.phase === "unconfirmed"}
        onclick={(event) => {
          if (active && canClose && event.currentTarget.isConnected) {
            focusTarget = event.currentTarget;
            selectedIdentity = identity;
            closing = true;
          }
        }}>{vb.t("encerrar")}</Button
      >{/if}
  </p>
  {#if status.phase !== "idle"}<p
      role={status.phase === "error" ? "alert" : "status"}
      class="m-0 text-xs text-muted-foreground"
    >
      {status.phase === "pending"
        ? vb.t("Enviando…")
        : status.phase === "unconfirmed"
          ? vb.t(
              "Ainda sem confirmação. Confira a sala antes de enviar novamente.",
            )
          : status.error}
    </p>{/if}
</section>
<ConfirmDialog
  open={closing && canClose && selectedIdentity === identity}
  title={vb.t("Encerrar a votação?")}
  confirmLabel={vb.t("Confirmar")}
  cancelLabel={vb.t("Cancelar")}
  busy={status.phase === "pending"}
  error={status.phase === "error" ? status.error : ""}
  onconfirm={close}
  onOpenChange={(open) => {
    if (!open) closing = false;
  }}
  returnFocus={() => focusTarget}
/>
