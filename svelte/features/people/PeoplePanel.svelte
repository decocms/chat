<script lang="ts">
  import { onDestroy, tick, untrack, type Snippet } from "svelte";
  import {
    canRemove,
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
      avatarUrl?: (email: string) => string | undefined;
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
  const avatarUrl = (email: string) =>
    vb.avatarUrl?.(email) ||
    (room.avatars?.[email]
      ? `/api/avatar/${encodeURIComponent(email)}?v=${room.avatars[email]}`
      : undefined);
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
    "tw:group/member tw:flex tw:h-9 tw:min-w-0 tw:items-center tw:gap-2 tw:rounded-lg tw:pr-1 tw:pl-2 tw:transition-colors tw:duration-150 tw:hover:bg-sidebar-accent tw:focus-within:bg-sidebar-accent";
  // Actions on a person's row wait behind hover (always shown on touch screens).
  const quiet =
    "tw:hidden tw:group-hover/member:inline-flex tw:group-focus-within/member:inline-flex tw:[@media(hover:none)]:inline-flex";
</script>

{#snippet outcomes()}
  {#each Object.entries($view.pending) as [email]}{#if $view.issues[email] !== "unconfirmed"}<p
        role="status"
        class="tw:m-0 tw:px-2 tw:break-words tw:text-xs tw:text-muted-foreground"
      >
        {email} · {vb.t("Aguardando confirmação…")}
      </p>{/if}{/each}
  {#each Object.entries($view.issues) as [email, issue]}<p
      role="alert"
      class="tw:m-0 tw:px-2 tw:whitespace-pre-wrap tw:break-words tw:text-xs tw:text-destructive"
    >
      {email} · {issueText(issue)}
    </p>{/each}
  {#each Object.entries($view.notices) as [email, action]}{#if action === "invite" || action === "resend"}<p
        role="status"
        class="tw:m-0 tw:px-2 tw:break-words tw:text-xs tw:text-muted-foreground"
      >
        {email} · {vb.t("enviado")} ✓
      </p>{/if}{/each}
  {#if $view.clipboard}<p
      role={$view.clipboard.status === "failed" ? "alert" : "status"}
      class="tw:m-0 tw:px-2 tw:break-words tw:text-xs tw:text-muted-foreground"
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
  {@const pending = room.pending?.includes(email) ?? false}
  {@const here = isOnline(email)}
  <div class={cn(row, !here && "tw:text-muted-foreground")} data-person={email}>
    {#if pending}<span class="tw:flex tw:shrink-0"
        ><PersonAvatar
          name={label(email)}
          url={avatarUrl(email)}
          class="tw:size-5"
        /></span
      >{:else}
      {#snippet face(props: Record<string, unknown>)}<button
          {...props}
          type="button"
          aria-label={`${label(email)} · ${here ? vb.t("Online") : vb.t("Offline")}`}
          data-presence={here ? "online" : "offline"}
          class="tw:relative tw:flex tw:shrink-0 tw:cursor-default tw:rounded-full tw:border-0 tw:bg-transparent tw:p-0 tw:focus-visible:outline-2 tw:focus-visible:outline-offset-2 tw:focus-visible:outline-ring"
          ><PersonAvatar
            name={label(email)}
            url={avatarUrl(email)}
            class="tw:size-5"
          /><span
            data-status-dot={here ? "online" : "offline"}
            class={cn(
              "tw:absolute tw:-right-0.5 tw:-bottom-0.5 tw:size-2 tw:rounded-full tw:ring-2 tw:ring-sidebar tw:group-hover/member:ring-sidebar-accent",
              here ? "tw:bg-brand" : "tw:bg-subtle-foreground",
            )}
          ></span></button
        >{/snippet}
      <TapTooltip
        label={here ? vb.t("Online") : vb.t("Offline")}
        trigger={face}
      />{/if}
    <span class="tw:min-w-0 tw:flex-1 tw:truncate" title={email}
      >{label(email)}</span
    >
    {#if pending}
      <Badge variant="muted" title={vb.t("Convidada(o), ainda não entrou")}
        >{vb.t("pendente")}</Badge
      >
      <Button
        variant="ghost"
        size="xs"
        class={cn(quiet, "tw:px-1.5")}
        data-copyinv={email}
        title={vb.t(
          "Copiar a mensagem de convite (link da sala + setup do agent) para mandar no WhatsApp",
        )}
        onclick={() => copy(email)}>{vb.t("copiar")}</Button
      >
      <Button
        variant="ghost"
        size="xs"
        class={cn(quiet, "tw:px-1.5")}
        data-resend={email}
        disabled={!!$view.pending[email]}
        onclick={() => {
          void session.mutate("resend", email, request || http);
        }}>{vb.t("reenviar")}</Button
      >
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
  class="tw:mt-auto tw:max-h-[32%] tw:shrink tw:space-y-0.5 tw:overflow-x-hidden tw:overflow-y-auto tw:overscroll-contain tw:font-sans tw:text-sm tw:leading-5 tw:text-sidebar-foreground tw:outline-none"
>
  {#if room.requests?.length}<div class="tw:mb-6 tw:space-y-0.5">
      <SectionHeader title={vb.t("Pedindo pra entrar")} level={4} />
      {#each room.requests as access (access.email)}<div
          class={cn(row, "tw:h-auto tw:min-h-9 tw:py-1")}
          data-access-request={access.email}
          title={`${access.email} · ${vb.t("pediu {ago}", { ago: vb.ago(access.ts) })}`}
        >
          <PersonAvatar
            name={access.name || access.email}
            url={avatarUrl(access.email)}
            class="tw:size-5"
          />
          <span class="tw:min-w-0 tw:flex-1">
            <span class="tw:block tw:truncate"
              >{access.name || access.email}</span
            >
            <span
              class="tw:block tw:truncate tw:text-xs tw:text-muted-foreground"
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
  <!-- Only you here: invite someone, like Pinned's and Epics' empty rows. -->
  {#if !everyone.length && !inviting}<button
      type="button"
      data-people-empty
      class="tw:flex tw:h-9 tw:w-full tw:cursor-pointer tw:items-center tw:gap-2 tw:rounded-lg tw:border tw:border-dashed tw:border-border tw:bg-transparent tw:px-2 tw:text-left tw:font-sans tw:text-sm tw:leading-5 tw:text-muted-foreground tw:transition-colors tw:duration-150 tw:hover:bg-sidebar-accent tw:hover:text-sidebar-foreground tw:focus-visible:outline-2 tw:focus-visible:outline-offset-2 tw:focus-visible:outline-ring tw:focus-visible:outline-solid"
      onclick={openInvite}
    >
      <span
        class="tw:flex tw:size-5 tw:shrink-0 tw:items-center tw:justify-center"
        ><Icon icon={UserPlus01} size={16} /></span
      >
      <span class="tw:min-w-0 tw:truncate"
        >{vb.t("Convidar alguém pra sala")}</span
      >
    </button>{/if}
  <form
    id="invite"
    data-invite-form
    class={inviting ? "" : "tw:hidden"}
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
    : room.pending?.includes(deletion?.email || "")
      ? vb.t("Cancelar o convite de {email}?", { email: deletion?.email || "" })
      : vb.t("Remover {email} deste vibebook?", {
          email: deletion?.email || "",
        })}
  description={deletion?.email}
  confirmLabel={deletion?.action === "deny"
    ? vb.t("Recusar")
    : vb.t("Remover do vibebook")}
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
