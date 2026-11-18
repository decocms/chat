<script lang="ts">
  import { untrack, onDestroy } from "svelte";
  import Heading from "../../lib/ui/Heading.svelte";
  import Button from "../../lib/studio/Button.svelte";
  import Input from "../../lib/studio/Input.svelte";
  import ConfirmDialog from "../../lib/components/ConfirmDialog.svelte";
  import { sandboxIdentity, type SandboxSession } from "./session";
  import type { SandboxCredentials } from "./credentials";
  import type { TerminalSession } from "./terminalSession";
  import { sandboxText, sandboxStateText, type SandboxLocale } from "./copy";
  import { sandboxLog } from "./log";
  let {
    owner,
    credentials,
    terminal,
    lang = "pt",
  }: {
    owner: SandboxSession;
    credentials: SandboxCredentials;
    terminal: TerminalSession;
    lang?: SandboxLocale;
  } = $props();
  const view = untrack(() => owner.state),
    credentialView = untrack(() => credentials.state);
  let apiKey = $state(""),
    token = $state(""),
    notice = $state("");
  let selected = $state<
    | { kind: "sandbox"; id: string; identity: string; name: string }
    | {
        kind: "credential";
        action: "remove-key" | "remove-token";
        identity: string;
      }
    | null
  >(null);
  let trigger: HTMLElement | null = null,
    active = true,
    copyTicket = 0;
  const text = (key: Parameters<typeof sandboxText>[1]) =>
    sandboxText(lang, key);
  const busy = $derived(
    !owner.current() ||
      ["pending", "unconfirmed"].includes($view.phase) ||
      ["pending", "unconfirmed"].includes($credentialView.phase),
  );
  const credentialIdentity = $derived(
    JSON.stringify([$credentialView.connected, $credentialView.claude]),
  );
  function validSelection() {
    const snapshot = selected;
    if (!snapshot) return false;
    return snapshot.kind === "credential"
      ? snapshot.identity === credentialIdentity
      : ($view.data?.sandboxes.some(
          (card) =>
            card.id === snapshot.id &&
            sandboxIdentity(card) === snapshot.identity,
        ) ?? false);
  }
  $effect(() => {
    if (selected && !validSelection()) selected = null;
  });
  async function save(action: "key" | "token") {
    if (busy || !owner.current()) return;
    const input = action === "key" ? apiKey : token;
    apiKey = "";
    token = "";
    await credentials.write(action, input);
  }
  function confirm() {
    if (busy || !validSelection() || !selected || !owner.current()) return;
    const snapshot = selected;
    selected = null;
    if (snapshot.kind === "sandbox")
      void owner.remove(snapshot.id, snapshot.identity);
    else void credentials.write(snapshot.action);
  }
  function removeCredential(
    action: "remove-key" | "remove-token",
    element: HTMLElement,
  ) {
    trigger = element;
    selected = { kind: "credential", action, identity: credentialIdentity };
  }
  $effect(() => {
    void $view.data;
    if (!owner.current()) {
      apiKey = "";
      token = "";
      selected = null;
      notice = "";
      copyTicket++;
    }
  });
  async function copy(value: string) {
    if (!owner.current()) return;
    const ticket = ++copyTicket;
    notice = "";
    try {
      await navigator.clipboard.writeText(value);
      if (active && owner.current() && ticket === copyTicket)
        notice = text("copied");
    } catch {
      if (active && owner.current() && ticket === copyTicket)
        notice = text("copyFailed");
    }
  }
  onDestroy(() => {
    active = false;
    copyTicket++;
    apiKey = "";
    token = "";
  });
</script>

<section
  data-vb-native
  data-native-sandboxes
  class="space-y-4 font-sans text-sm text-foreground"
>
  <div class="flex items-center gap-2">
    <Heading
      level={3}
      class="m-0 flex-1 font-sans text-base font-semibold tracking-normal"
      >{text("title")}</Heading
    ><Button
      variant="ghost"
      size="sm"
      disabled={$view.loading}
      onclick={() => void owner.refresh(true)}>{text("refresh")}</Button
    >
  </div>
  {#if $view.loading && !$view.data}<p role="status">{text("loading")}</p>{/if}
  {#if $view.readError}<p role="alert" class="text-destructive">
      {text("readFailed")}
    </p>{/if}
  {#if $view.data}
    {#each ["key", "token"] as kind}
      {@const configured =
        kind === "key" ? $credentialView.connected : $credentialView.claude}
      <div class="space-y-2 rounded-surface border border-border p-3">
        <div class="flex items-center gap-2">
          <strong class="flex-1"
            >{text(kind === "key" ? "key" : "token")}</strong
          ><span class="text-muted-foreground"
            >{text(configured ? "connected" : "missing")}</span
          >{#if configured}<Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onclick={(event) =>
                removeCredential(
                  kind === "key" ? "remove-key" : "remove-token",
                  event.currentTarget,
                )}>{text("remove")}</Button
            >{/if}
        </div>
        {#if !configured}
          {@const command =
            kind === "key"
              ? "npx freestyle@latest tokens create vibebook"
              : "claude setup-token"}
          <div class="flex items-center gap-2">
            <code class="min-w-0 flex-1 overflow-auto font-mono text-xs"
              >{command}</code
            ><Button
              variant="outline"
              size="sm"
              onclick={() => void copy(command)}>{text("copy")}</Button
            >
          </div>
          <form
            class="flex gap-2"
            onsubmit={(event) => {
              event.preventDefault();
              void save(kind === "key" ? "key" : "token");
            }}
          >
            {#if kind === "key"}<Input
                type="password"
                bind:value={apiKey}
                aria-label={text("key")}
                autocomplete="off"
                required
                disabled={busy}
              />{:else}<Input
                type="password"
                bind:value={token}
                aria-label={text("token")}
                autocomplete="off"
                required
                disabled={busy}
              />{/if}
            <Button type="submit" disabled={busy}>{text("save")}</Button>
          </form>
        {/if}
      </div>
    {/each}
    {#if notice}<p role="status">{notice}</p>{/if}
    {#if $credentialView.notice}<p role="status">
        {text($credentialView.notice === "removed" ? "removed" : "saved")}
      </p>{/if}
    {#if $credentialView.phase === "error"}<p
        role="alert"
        class="text-destructive"
      >
        {text("failed")}
      </p>{/if}
    {#if $credentialView.phase === "unconfirmed"}<p role="status">
        {text("unconfirmed")}
      </p>
      <Button
        variant="outline"
        onclick={() => {
          credentials.review();
          void owner.refresh(true);
        }}>{text("reviewed")}</Button
      >{/if}
    {#each $view.data.sandboxes as card (card.id)}
      <article
        data-sandbox-id={card.id}
        class="space-y-3 rounded-surface border border-border p-3"
      >
        <div class="flex items-start gap-3">
          <div class="min-w-0 flex-1">
            <strong class="block break-words"
              >☁ {card.name ?? text("unnamed")}</strong
            >
            <p class="m-0 text-xs text-muted-foreground">
              {sandboxStateText(card.state, lang)} · {new Intl.NumberFormat(
                lang,
                { style: "currency", currency: "USD" },
              ).format(card.rate)}/h
            </p>
            {#if card.error}<p class="m-0 break-words text-xs text-destructive">
                {sandboxLog(card.error)}
              </p>{/if}
          </div>
          <span class="text-xs"
            >{card.cost_unknown
              ? text("costUnknown")
              : new Intl.NumberFormat(lang, {
                  style: "currency",
                  currency: "USD",
                }).format(card.cost)}</span
          >
        </div>
        {#if $view.logs[card.id] || (!card.ready && card.log)}<details>
            <summary class="cursor-pointer">{text("log")}</summary>
            <pre
              class="max-h-64 overflow-auto whitespace-pre-wrap break-words font-mono text-xs">{sandboxLog(
                $view.logs[card.id] || card.log,
              )}</pre>
          </details>{/if}
        <div class="flex flex-wrap gap-2">
          {#if card.state !== "deleted"}<Button
              size="sm"
              disabled={busy || !$credentialView.connected}
              onclick={(event) => terminal.open(card, event.currentTarget)}
              >{text("terminal")}</Button
            >{/if}
          {#if card.state === "running"}<Button
              variant="outline"
              size="sm"
              disabled={busy || !$credentialView.connected}
              onclick={() =>
                void owner.power(card.id, "pause", sandboxIdentity(card))}
              >{text("pause")}</Button
            >{:else if card.state === "paused" || card.state === "stopped"}<Button
              variant="outline"
              size="sm"
              disabled={busy || !$credentialView.connected}
              onclick={() =>
                void owner.power(card.id, "start", sandboxIdentity(card))}
              >{text("start")}</Button
            >{/if}
          {#if !card.ready && card.state === "running"}<Button
              variant="outline"
              size="sm"
              disabled={busy || !$credentialView.connected}
              onclick={() => void owner.setup(card.id, sandboxIdentity(card))}
              >{text("setup")}</Button
            >{/if}
          <Button
            variant="ghost"
            size="sm"
            disabled={busy || !$credentialView.connected}
            onclick={(event) => {
              trigger = event.currentTarget;
              selected = {
                kind: "sandbox",
                id: card.id,
                identity: sandboxIdentity(card),
                name: card.name ?? text("unnamed"),
              };
            }}>{text("remove")}</Button
          >
        </div>
      </article>
    {:else}<p class="text-muted-foreground">{text("empty")}</p>{/each}
    {#if $view.phase === "pending" || $credentialView.phase === "pending"}<p
        role="status"
      >
        {text($view.operation === "setup" ? "setupPending" : "pending")}
      </p>{/if}
    {#if $view.phase === "error"}<p role="alert" class="text-destructive">
        {text("failed")}
      </p>{/if}
    {#if $view.phase === "unconfirmed"}<p role="status">
        {text("unconfirmed")}
      </p>
      {#if $view.candidates.length}<p class="text-muted-foreground">
          {text("uncertainCreate")}
        </p>{/if}<Button
        variant="outline"
        onclick={() => {
          owner.review();
          void owner.refresh(true);
        }}>{text("reviewed")}</Button
      >{/if}
    <Button
      disabled={busy ||
        !$credentialView.connected ||
        $view.data.sandboxes.length >= 3}
      onclick={() => {
        if (!busy) void owner.create();
      }}>{text("create")}</Button
    >
    <p class="m-0 text-xs text-muted-foreground">{text("costHelp")}</p>
    <p class="m-0 text-xs text-muted-foreground">
      {text($credentialView.connected ? "createLimit" : "keyRequired")}
    </p>
  {/if}
</section>
<ConfirmDialog
  open={selected !== null}
  title={text(
    selected?.kind === "sandbox" ? "removeTitle" : "credentialRemoveTitle",
  )}
  description={text(
    selected?.kind === "sandbox"
      ? "removeBody"
      : selected?.kind === "credential" && selected.action === "remove-token"
        ? "removeTokenBody"
        : "removeKeyBody",
  )}
  confirmLabel={text("remove")}
  cancelLabel={text("cancel")}
  confirmDisabled={busy || !validSelection()}
  onconfirm={confirm}
  onOpenChange={(open) => {
    if (!open) selected = null;
  }}
  returnFocus={() => (trigger?.isConnected ? trigger : null)}
/>
