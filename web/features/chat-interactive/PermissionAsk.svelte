<script lang="ts">
  import { onDestroy, untrack } from "svelte";
  import type { Room, Message } from "../../../shared/room";
  import type { ChatActions, ChatBridge } from "../../app/chatTypes";
  import type { Choices } from "./model";
  import { answerOf, canAnswer } from "./model";
  import { createInteractiveSession, idleState } from "./session";
  import Button from "../../lib/studio/Button.svelte";
  import ConfirmDialog from "../../lib/components/ConfirmDialog.svelte";
  let {
    choices,
    message,
    room,
    actions,
    vb,
  }: {
    choices: Choices;
    message: Message;
    room: Room;
    actions: ChatActions;
    vb: ChatBridge;
  } = $props();
  let active = true,
    status = $state(idleState()),
    selection = $state<"Aprovar" | "Negar" | null>(null),
    focusTarget = $state<HTMLElement | null>(null),
    selectedIdentity = $state<string | undefined>();
  const identity = $derived(
    JSON.stringify([
      message.thread,
      message.author,
      message.kind,
      message.text,
      message.choices,
    ]),
  );
  const session = untrack(() =>
    createInteractiveSession(
      room.id,
      message.id,
      (next) => (status = next),
      undefined,
      "permission",
    ),
  );
  const answer = $derived(answerOf(room, message));
  const approved = $derived(!!answer && /^\s*aprov/i.test(answer.text));
  const actionable = $derived(canAnswer(room, message) && !choices.closed);
  $effect(() => {
    const snapshot = room;
    untrack(() => session.sync(snapshot));
  });
  $effect(() => {
    if (
      !actionable ||
      status.phase === "unconfirmed" ||
      (selectedIdentity !== undefined && selectedIdentity !== identity)
    )
      selection = null;
  });
  onDestroy(() => {
    active = false;
    session.dispose();
  });
  function select(value: "Aprovar" | "Negar", event: MouseEvent) {
    if (
      !active ||
      !actionable ||
      !(event.currentTarget instanceof HTMLElement) ||
      !event.currentTarget.isConnected
    )
      return;
    focusTarget = event.currentTarget as HTMLElement;
    selectedIdentity = identity;
    selection = value;
  }
  function confirm() {
    if (active && actionable && selection && selectedIdentity === identity)
      void session.reply(selection, actions.request);
  }
</script>

<div data-permission class="space-y-2 font-sans text-sm text-foreground">
  {#if answer}<p
      role="status"
      class="m-0 rounded-control border border-border bg-muted p-3"
    >
      {approved
        ? "✓ " + vb.t("Aprovado por {who}", { who: vb.name(answer.author) })
        : "✕ " + vb.t("Negado por {who}", { who: vb.name(answer.author) })} · {vb.hhmm(
        answer.ts,
      )}
    </p>
  {:else if choices.closed}<p class="m-0 text-muted-foreground">
      {vb.t("foi pro terminal")}
    </p>
  {:else if actionable}<div class="flex flex-wrap gap-2">
      <Button
        data-permission-value="Aprovar"
        disabled={status.phase === "pending" || status.phase === "unconfirmed"}
        onclick={(event) => select("Aprovar", event)}>{vb.t("Aprovar")}</Button
      ><Button
        data-permission-value="Negar"
        variant="outline"
        disabled={status.phase === "pending" || status.phase === "unconfirmed"}
        onclick={(event) => select("Negar", event)}>{vb.t("Negar")}</Button
      >
    </div>
  {:else}<div class="flex flex-wrap gap-2">
      {#each choices.options as option}<span
          class="rounded-control border border-border px-3 py-2">{option}</span
        >{/each}
    </div>
    <small class="text-muted-foreground"
      >{vb.t("esperando {who}", { who: vb.name(message.author) })}</small
    >{/if}
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
</div>
<ConfirmDialog
  open={selection !== null && actionable && selectedIdentity === identity}
  title={selection === "Aprovar"
    ? vb.t("Aprovar este pedido?")
    : vb.t("Negar este pedido?")}
  confirmLabel={vb.t("Confirmar")}
  cancelLabel={vb.t("Cancelar")}
  busy={status.phase === "pending"}
  error={status.phase === "error" ? status.error : ""}
  onconfirm={confirm}
  onOpenChange={(open) => {
    if (!open) selection = null;
  }}
  returnFocus={() => focusTarget}
/>
