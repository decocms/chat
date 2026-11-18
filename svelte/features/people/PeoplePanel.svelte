<script lang="ts">
  import { onDestroy, tick, untrack, type Snippet } from "svelte";
  import {
    canRemove,
    isInvited,
    inviteMessage,
    normalizeEmail,
    peopleModel,
    type PeopleRoom,
  } from "./model";
  import { createPeopleRequest, type PeopleRequest } from "./api";
  import { createPeopleSession } from "./session";
  import ConfirmDialog from "../../lib/components/ConfirmDialog.svelte";
  import InlineAdd from "../../lib/components/InlineAdd.svelte";
  import PersonAvatar from "../../lib/components/PersonAvatar.svelte";
  import TapTooltip from "../../lib/components/TapTooltip.svelte";
  import Badge from "../../lib/studio/Badge.svelte";
  import Button from "../../lib/studio/Button.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import IconButton from "../../lib/studio/IconButton.svelte";
  import { Plus, UserPlus01, X } from "../../lib/studio/icons";
  import { cn } from "../../lib/studio/utils";
  import SectionHeader from "../room-sidebar/SectionHeader.svelte";
  let {
    room,
    friends = [],
    vb,
    agents,
    request,
    hideSelf = false,
  }: {
    room: PeopleRoom;
    friends?: string[];
    vb: {
      t: (text: string, vars?: Record<string, string | number>) => string;
      name: (email: string) => string;
      ago: (ts: number) => string;
      avatarVersion: (email: string) => number | null | undefined;
    };
    agents?: Snippet<[string]>;
    request?: PeopleRequest;
    /** Desktop sidebar: you sit at its foot, not in the list. */
    hideSelf?: boolean;
  } = $props();
  const session = untrack(() => createPeopleSession(room.id));
  const http = untrack(() => createPeopleRequest(room.id));
  const view = session.state;
  const model = $derived(peopleModel(room, friends));
  const ids = $props.id();
  let dialogOpen = $state(false),
    deletion = $state<{ email: string; action: "remove" | "deny" } | null>(
      null,
    );
  let trigger = $state<HTMLElement | null>(null),
    root = $state<HTMLElement | null>(null);
  /** The invite row: the `+` in the header turns into a row you type an email into (friends are suggested). */
  let inviting = $state(false),
    toggle = $state<HTMLButtonElement | null>(null),
    input = $state<HTMLInputElement | null>(null);
  const origin = typeof location === "undefined" ? "" : location.origin;
  const label = (email: string) => room.names?.[email] || vb.name(email);
  const everyone = $derived(
    [...model.online, ...model.offline].filter(
      (email) => !hideSelf || email !== room.me,
    ),
  );
  /** You are always online to yourself: the page you are looking at is connected. */
  const isOnline = (email: string) =>
    room.online.includes(email) || email === room.me;
  const issueText = (issue: string) =>
    issue === "invalid-email"
      ? vb.t("Email inválido.")
      : issue === "already-member"
        ? vb.t("Esta pessoa já está na sala.")
        : issue === "unconfirmed"
          ? vb.t(
              "Ainda não recebi a confirmação. Confira antes de tentar de novo.",
            )
          : issue;
  $effect(() => {
    session.sync(room);
    if (
      deletion &&
      (deletion.action === "remove"
        ? !canRemove(room, deletion.email)
        : !room.requests?.some((r) => r.email === deletion!.email))
    ) {
      dialogOpen = false;
      deletion = null;
    }
  });
  onDestroy(() => {
    session.dispose();
  });
  function copy(email: string) {
    const text = inviteMessage(room, email, origin, vb.t);
    void session.copy(
      email,
      () =>
        navigator.clipboard?.writeText(text) ??
        Promise.reject(new Error("clipboard unavailable")),
    );
  }
  function invite(raw: string): Promise<boolean> {
    const email = normalizeEmail(raw);
    if ($view.pending[email]) return Promise.resolve(false);
    const action = room.pending?.includes(email) ? "resend" : "invite";
    return session.mutate(action, email, request || http);
  }
  async function openInvite() {
    inviting = true;
    await tick();
    input?.focus();
  }
  async function closeInvite() {
    inviting = false;
    session.edit("");
    await tick();
    if (toggle?.isConnected) toggle.focus();
  }
  async function submitInvite(event: SubmitEvent) {
    event.preventDefault();
    const email = $view.draft;
    if (!email.trim()) return input?.focus();
    if (await invite(email)) {
      inviting = false;
      await tick();
      if (toggle?.isConnected) toggle.focus();
    }
  }
  function confirm(
    email: string,
    action: "remove" | "deny",
    element: HTMLElement,
  ) {
    deletion = { email, action };
    trigger = element;
    dialogOpen = true;
  }
  async function remove() {
    const selected = deletion;
    if (!selected) return;
    const success = await session.mutate(
      selected.action,
      selected.email,
      request || http,
    );
    if (success && deletion === selected && !$view.pending[selected.email])
      dialogOpen = false;
  }
  const row =
    "group/member flex h-9 min-w-0 items-center gap-2 rounded-lg pr-1 pl-2 transition-colors duration-150 hover:bg-sidebar-accent focus-within:bg-sidebar-accent";
  // Actions on a person's row wait behind hover (always shown on touch screens).
  const quiet =
    "hidden group-hover/member:inline-flex group-focus-within/member:inline-flex [@media(hover:none)]:inline-flex";
</script>

{#snippet outcomes()}
  {#each Object.entries($view.pending) as [email]}{#if $view.issues[email] !== "unconfirmed"}<p
        role="status"
        class="m-0 px-2 break-words text-xs text-muted-foreground"
      >
        {email} · {vb.t("Aguardando confirmação…")}
      </p>{/if}{/each}
  {#each Object.entries($view.issues) as [email, issue]}<p
      role="alert"
      class="m-0 px-2 whitespace-pre-wrap break-words text-xs text-destructive"
    >
      {email} · {issueText(issue)}
    </p>{/each}
  {#each Object.entries($view.notices) as [email, action]}{#if action === "invite" || action === "resend"}<p
        role="status"
        class="m-0 px-2 break-words text-xs text-muted-foreground"
      >
        {email} · {vb.t("enviado")} ✓
      </p>{/if}{/each}
  {#if $view.clipboard}<p
      role={$view.clipboard.status === "failed" ? "alert" : "status"}
      class="m-0 px-2 break-words text-xs text-muted-foreground"
      data-invite-clipboard={$view.clipboard.status}
    >
      {$view.clipboard.status === "failed"
        ? vb.t(
            'Não consegui copiar. Use "copiar" ao lado de {email} em Pessoas.',
            { email: $view.clipboard.email },
          )
        : vb.t(
            "Copiei a mensagem com o link da sala e o setup do agent para {name}: cola no WhatsApp.",
            { name: vb.name($view.clipboard.email) },
          )}
    </p>{/if}
{/snippet}
{#snippet member(email: string)}
  {@const declined =
    !room.pending?.includes(email) && !!room.declined?.includes(email)}
  {@const pending = declined || (room.pending?.includes(email) ?? false)}
  {@const here = isOnline(email)}
  <div class={cn(row, !here && "text-muted-foreground")} data-person={email}>
    {#if pending}<span class="flex shrink-0"
        ><PersonAvatar
          {email}
          version={vb.avatarVersion(email)}
          class="size-5"
        /></span
      >{:else}
      {#snippet face(props: Record<string, unknown>)}<button
          {...props}
          type="button"
          aria-label={`${label(email)} · ${here ? vb.t("Online") : vb.t("Offline")}`}
          data-presence={here ? "online" : "offline"}
          class="relative flex shrink-0 cursor-default rounded-full border-0 bg-transparent p-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          ><PersonAvatar
            {email}
            version={vb.avatarVersion(email)}
            class="size-5"
          /><span
            data-status-dot={here ? "online" : "offline"}
            class={cn(
              "absolute -right-0.5 -bottom-0.5 size-2 rounded-full ring-2 ring-sidebar group-hover/member:ring-sidebar-accent",
              here ? "bg-brand" : "bg-subtle-foreground",
            )}
          ></span></button
        >{/snippet}
      <TapTooltip
        label={here ? vb.t("Online") : vb.t("Offline")}
        trigger={face}
      />{/if}
    <span class="min-w-0 flex-1 truncate" title={email}>{label(email)}</span>
    {#if pending}
      <Badge
        variant="muted"
        data-invite-state={declined ? "declined" : "waiting"}
        title={declined
          ? vb.t("Recusou o convite")
          : vb.t("Convidada(o), ainda não respondeu")}
        >{declined ? vb.t("recusou") : vb.t("aguardando")}</Badge
      >
      {#if !declined}<Button
          variant="ghost"
          size="xs"
          class={cn(quiet, "px-1.5")}
          data-copyinv={email}
          title={vb.t(
            "Copiar a mensagem de convite (link da sala + setup do agent) para mandar no WhatsApp",
          )}
          onclick={() => copy(email)}>{vb.t("copiar")}</Button
        >
        <Button
          variant="ghost"
          size="xs"
          class={cn(quiet, "px-1.5")}
          data-resend={email}
          disabled={!!$view.pending[email]}
          onclick={() => {
            void session.mutate("resend", email, request || http);
          }}>{vb.t("reenviar")}</Button
        >{/if}
    {/if}
    {#if canRemove(room, email)}<IconButton
        variant="ghost-destructive"
        size="icon-xs"
        class={quiet}
        data-remove={email}
        label={pending
          ? vb.t("Cancelar convite")
          : vb.t("Remover {email}", { email })}
        disabled={!!$view.pending[email]}
        onclick={(event) => confirm(email, "remove", event.currentTarget)}
        ><Icon icon={X} /></IconButton
      >{/if}
  </div>
  {@render agents?.(email)}
{/snippet}
<section
  bind:this={root}
  tabindex="-1"
  data-vb-native
  data-people-panel
  class={cn(
    "mt-auto max-h-[32%] space-y-0.5 overflow-x-hidden overflow-y-auto overscroll-contain font-sans text-sm leading-5 text-sidebar-foreground outline-none",
    // In the sidebar it gives way to the epics, down to its title and ~3 rows.
    everyone.length + model.invited.length + (room.requests?.length ?? 0) > 1
      ? "min-h-32 shrink"
      : "shrink-0",
  )}
>
  {#if room.requests?.length}<div class="mb-6 space-y-0.5">
      <SectionHeader title={vb.t("Pedindo pra entrar")} level={4} />
      {#each room.requests as access (access.email)}<div
          class={cn(row, "h-auto min-h-9 py-1")}
          data-access-request={access.email}
          title={`${access.email} · ${vb.t("pediu {ago}", { ago: vb.ago(access.ts) })}`}
        >
          <PersonAvatar
            email={access.email}
            version={vb.avatarVersion(access.email)}
            class="size-5"
          />
          <span class="min-w-0 flex-1">
            <span class="block truncate">{access.name || access.email}</span>
            <span class="block truncate text-xs text-muted-foreground"
              >{access.email} · {vb.t("pediu {ago}", {
                ago: vb.ago(access.ts),
              })}</span
            >
          </span>
          <Button
            size="xs"
            variant="secondary"
            data-ask={access.email}
            data-ok="1"
            disabled={!!$view.pending[access.email]}
            onclick={() => {
              void session.mutate("approve", access.email, request || http);
            }}>{vb.t("liberar")}</Button
          >
          <IconButton
            size="icon-xs"
            data-ask={access.email}
            data-ok=""
            label={vb.t("Recusar {email}", { email: access.email })}
            disabled={!!$view.pending[access.email]}
            onclick={(event) =>
              confirm(access.email, "deny", event.currentTarget)}
            ><Icon icon={X} /></IconButton
          >
        </div>{/each}
    </div>{/if}
  <SectionHeader title={vb.t("Pessoas e agents")}>
    {#snippet action()}{#if !inviting}<IconButton
          size="icon-xs"
          tooltipSide="bottom"
          label={vb.t("Convidar")}
          data-invite-toggle
          bind:ref={toggle}
          onclick={openInvite}><Icon icon={Plus} /></IconButton
        >{/if}{/snippet}
  </SectionHeader>
  {#each everyone as email (email)}{@render member(email)}{/each}
  {#if model.invited.length}<SectionHeader
      title={vb.t("Convidados")}
      level={4}
    />
    {#each model.invited as email (email)}{@render member(email)}{/each}{/if}
  <!-- Only you here: invite someone, like Pinned's and Epics' empty rows. -->
  {#if !everyone.length && !inviting}<button
      type="button"
      data-people-empty
      class="flex h-9 w-full cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border bg-transparent px-2 text-left font-sans text-sm leading-5 text-muted-foreground transition-colors duration-150 hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring focus-visible:outline-solid"
      onclick={openInvite}
    >
      <span class="flex size-5 shrink-0 items-center justify-center"
        ><Icon icon={UserPlus01} size={16} /></span
      >
      <span class="min-w-0 truncate">{vb.t("Convidar alguém pra sala")}</span>
    </button>{/if}
  <form
    id="invite"
    data-invite-form
    class={inviting ? "" : "hidden"}
    onsubmit={submitInvite}
  >
    <InlineAdd
      type="email"
      bind:ref={input}
      bind:value={() => $view.draft, (value) => session.edit(value)}
      placeholder={vb.t("convidar por email")}
      aria-label={vb.t("convidar por email")}
      list={`${ids}-friends`}
      autocomplete="off"
      autocapitalize="none"
      spellcheck={false}
      enterkeyhint="send"
      confirmDisabled={!!$view.pending[normalizeEmail($view.draft)]}
      confirmLabel={vb.t("convidar por email")}
      cancelLabel={vb.t("Cancelar")}
      oncancel={closeInvite}
    />
    <datalist id={`${ids}-friends`}
      >{#each model.friends as email (email)}<option value={email}
          >{label(email)}</option
        >{/each}</datalist
    >
  </form>
  {@render outcomes()}
</section>
<ConfirmDialog
  bind:open={dialogOpen}
  title={deletion?.action === "deny"
    ? vb.t("Recusar o pedido de {email}?", { email: deletion.email })
    : isInvited(room, deletion?.email || "")
      ? vb.t("Cancelar o convite de {email}?", { email: deletion?.email || "" })
      : vb.t("Remover {email} desta sala?", {
          email: deletion?.email || "",
        })}
  description={deletion?.email}
  confirmLabel={deletion?.action === "deny"
    ? vb.t("Recusar")
    : vb.t("Remover da sala")}
  cancelLabel={vb.t("Cancelar")}
  busy={!!(
    deletion &&
    $view.pending[deletion.email] &&
    $view.issues[deletion.email] !== "unconfirmed"
  )}
  confirmDisabled={!!(deletion && $view.pending[deletion.email])}
  error={deletion && $view.issues[deletion.email]
    ? issueText($view.issues[deletion.email])
    : ""}
  onconfirm={() => {
    void remove();
  }}
  returnFocus={() => (trigger?.isConnected ? trigger : root)}
/>
