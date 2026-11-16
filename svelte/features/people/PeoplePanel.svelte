<script lang="ts">
  import { onDestroy, tick, untrack, type Snippet } from "svelte";
  import { MediaQuery } from "svelte/reactivity";
  import {
    canRemove,
    canAct,
    findMatch,
    inviteMessage,
    isEmail,
    normalizeEmail,
    peopleModel,
    shareMessage,
    whatsappLink,
    type PeopleRoom,
  } from "./model";
  import { createPeopleRequest, type PeopleRequest } from "./api";
  import { createPeopleSession } from "./session";
  import AlertDialog from "../../lib/ui/AlertDialog.svelte";
  import Avatar from "../../lib/ui/Avatar.svelte";
  import Badge from "../../lib/ui/Badge.svelte";
  import Button from "../../lib/ui/Button.svelte";
  import { buttonVariants } from "../../lib/ui/button";
  import Dialog from "../../lib/ui/Dialog.svelte";
  import Icon from "../../lib/ui/Icon.svelte";
  import IconButton from "../../lib/ui/IconButton.svelte";
  import Tip from "../../lib/ui/Tip.svelte";
  import SectionHeader from "../room-sidebar/SectionHeader.svelte";
  let {
    room,
    friends = [],
    vb,
    agents,
    request,
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
  /**
   * The invite modal: pick friends or type emails (they become chips), then one Send.
   * After sending, the same modal lists who was invited, each with a WhatsApp nudge.
   */
  let inviting = $state(false),
    toggle = $state<HTMLButtonElement | null>(null),
    search = $state<HTMLInputElement | null>(null),
    list = $state<HTMLElement | null>(null),
    /** Chosen, not sent yet, in the order they were picked. */
    selected = $state<string[]>([]),
    /** The last Send's people: while set, the modal shows their outcome instead of the search. */
    sent = $state<string[] | null>(null),
    linkCopy = $state<"copied" | "failed" | null>(null),
    more = $state<HTMLButtonElement | null>(null),
    active = $state(-1);
  /** Enter picks the highlighted row only when the arrow keys put it there; a hovered row never eats the Send. */
  let viaKeys = false;
  let linkTimer: ReturnType<typeof setTimeout> | undefined;
  const phone = new MediaQuery("(max-width: 639px)");
  const origin = typeof location === "undefined" ? "" : location.origin;
  const label = (email: string) => room.names?.[email] || vb.name(email);
  const query = $derived($view.draft.trim());
  const typedEmail = $derived(normalizeEmail($view.draft));
  /** Friends already in the room (members or pending invites) are not listed: there is nothing to send them. */
  const friendRows = $derived(
    friends
      .filter((email) => !room.members.includes(email))
      .map((email) => {
        const name = label(email);
        return {
          email,
          name,
          nameMatch: findMatch(name, query),
          emailMatch: findMatch(email, query),
        };
      })
      .filter((row) => !query || row.nameMatch || row.emailMatch),
  );
  const typedUnlisted = $derived(
    isEmail(typedEmail) && !friendRows.some((row) => row.email === typedEmail)
      ? typedEmail
      : null,
  );
  /** A typed email of someone already in the room: a plain status row, nothing to invite. */
  const memberRow = $derived(
    typedUnlisted && room.members.includes(typedUnlisted)
      ? typedUnlisted
      : null,
  );
  /** A full email that is not one of the listed friends (nor a member) gets its own first row. */
  const emailRow = $derived(memberRow ? null : typedUnlisted);
  const options = $derived([
    ...(emailRow ? [emailRow] : []),
    ...friendRows.map((row) => row.email),
  ]);
  const optionId = (index: number) => `${ids}-option-${index}`;
  $effect(() => {
    void query;
    // A new search highlights its first row (the "Invite <email>" row when there is one).
    active = untrack(() => (query && options.length ? 0 : -1));
  });
  $effect(() => {
    if (active >= options.length) active = options.length ? 0 : -1;
  });
  $effect(() => {
    if (active < 0 || !list) return;
    list
      .querySelector(`[id="${optionId(active)}"]`)
      ?.scrollIntoView?.({ block: "nearest" });
  });
  /** Someone joined or was invited elsewhere while chosen: they leave the selection. */
  $effect(() => {
    const keep = selected.filter((email) => canAct(room, "invite", email));
    if (keep.length !== untrack(() => selected.length)) selected = keep;
  });
  type RowState =
    | "idle"
    | "pending"
    | "unconfirmed"
    | "error"
    | "invited"
    | "member"
    | "cancelled";
  function rowState(email: string): RowState {
    const notice = $view.notices[email],
      accepted = notice === "invite" || notice === "resend";
    if ($view.pending[email]) {
      // The server accepted it and the room has not shown the pending row yet.
      if (accepted) return "invited";
      // Still waiting on the server: not a failure, and nothing to retry yet.
      return $view.issues[email] === "unconfirmed" ? "unconfirmed" : "pending";
    }
    if ($view.issues[email]) return "error";
    if (room.pending?.includes(email)) return "invited";
    if (room.members.includes(email)) return "member";
    // Invited from here, then removed by someone else: not ours to redo.
    return accepted ? "cancelled" : "idle";
  }
  const sentStates = $derived((sent ?? []).map(rowState));
  const sentSummary = $derived(
    sentStates.some((state) => state === "pending" || state === "unconfirmed")
      ? "sending"
      : sentStates.some((state) => state === "error" || state === "idle")
        ? "partial"
        : "done",
  );
  /** Rows show their own outcome; the outcome area leaves those out while the modal is open. */
  const rowEmails = $derived(
    new Set([...options, ...(memberRow ? [memberRow] : []), ...(sent ?? [])]),
  );
  /** In the modal only the latest "sent" line, for an email whose row is gone. */
  const lastNotice = $derived(
    Object.entries($view.notices)
      .filter(
        ([email, action]) =>
          (action === "invite" || action === "resend") && !rowEmails.has(email),
      )
      .at(-1)?.[0],
  );
  function openInvite() {
    session.edit("");
    session.clearClipboard();
    linkCopy = null;
    selected = [];
    sent = null;
    active = -1;
    inviting = true;
  }
  /** Picking a row (click, Enter or Space) adds it to the chips, or takes it out again. */
  function pick(email: string) {
    if (selected.includes(email))
      selected = selected.filter((other) => other !== email);
    else if (canAct(room, "invite", email)) selected = [...selected, email];
    else return;
    // An empty search keeps the highlight where it was, so the arrows go on from there.
    if ($view.draft) session.edit("");
    viaKeys = false;
    search?.focus();
  }
  function unpick(email: string) {
    selected = selected.filter((other) => other !== email);
    search?.focus();
  }
  function sendAll() {
    const people = selected.filter((email) => canAct(room, "invite", email));
    if (!people.length) return;
    sent = people;
    selected = [];
    session.edit("");
    active = -1;
    for (const email of people) void invite(email);
    // The search and Send are gone: focus lands on the done view's own action.
    void tick().then(() => more?.focus());
  }
  function retry(email: string) {
    void invite(email);
    void tick().then(() => more?.focus());
  }
  function inviteMore() {
    sent = null;
    session.clearClipboard();
    void tick().then(() => search?.focus());
  }
  /** Options stay out of the tab order (the search owns the keyboard), but answer keys if focused. */
  function optionKey(event: KeyboardEvent, email: string) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    pick(email);
  }
  function onSearchKey(event: KeyboardEvent) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!options.length) return;
      event.preventDefault();
      viaKeys = true;
      const step = event.key === "ArrowDown" ? 1 : -1;
      active =
        active < 0
          ? step > 0
            ? 0
            : options.length - 1
          : (active + step + options.length) % options.length;
    } else if (event.key === "Enter") {
      // The Enter that confirms an IME composition is not a pick.
      if (event.isComposing || event.keyCode === 229) return;
      event.preventDefault();
      const email = options[active];
      // Enter on an empty search sends what is chosen, unless the arrows just moved to a row.
      if (!query && selected.length && !(email && viaKeys)) sendAll();
      // A typed email that is already a chip stays one: Enter only clears the search.
      else if (query && selected.includes(typedEmail)) session.edit("");
      else if (email) pick(email);
      else if (isEmail(typedEmail)) pick(typedEmail);
    } else if (
      event.key === "Backspace" &&
      !$view.draft &&
      selected.length &&
      event.currentTarget instanceof HTMLInputElement &&
      event.currentTarget.selectionStart === 0
    ) {
      event.preventDefault();
      selected = selected.slice(0, -1);
    }
  }
  function copyLink() {
    const url = `${origin}/b/${room.id}`;
    void (
      navigator.clipboard?.writeText(url) ??
      Promise.reject(new Error("clipboard unavailable"))
    ).then(
      () => {
        linkCopy = "copied";
        clearTimeout(linkTimer);
        linkTimer = setTimeout(() => (linkCopy = null), 2000);
      },
      () => {
        clearTimeout(linkTimer);
        linkCopy = "failed";
      },
    );
  }
  const everyone = $derived([...model.online, ...model.offline]);
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
    clearTimeout(linkTimer);
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
</script>

{#snippet outcomes(inModal: boolean)}
  {#each Object.entries($view.pending) as [email]}{#if $view.issues[email] !== "unconfirmed" && !(inModal && rowEmails.has(email))}<p
        role="status"
        class="tw:m-0 tw:break-words tw:text-xs tw:text-muted-foreground"
      >
        {email} · {vb.t("Aguardando confirmação…")}
      </p>{/if}{/each}
  {#each Object.entries($view.issues) as [email, issue]}{#if !(inModal && rowEmails.has(email))}<p
        role="alert"
        class="tw:m-0 tw:whitespace-pre-wrap tw:break-words tw:text-xs tw:text-destructive"
      >
        {email} · {issueText(issue)}
      </p>{/if}{/each}
  {#each Object.entries($view.notices) as [email, action]}{#if (action === "invite" || action === "resend") && (!inModal || email === lastNotice)}<p
        role="status"
        class="tw:m-0 tw:break-words tw:text-xs tw:text-muted-foreground"
      >
        {email} · {vb.t("enviado")} ✓
      </p>{/if}{/each}
  {#if $view.clipboard && !(inModal && $view.clipboard.status === "copied" && $view.issues[$view.clipboard.email])}<p
      role={$view.clipboard.status === "failed" ? "alert" : "status"}
      class="tw:m-0 tw:break-words tw:text-xs tw:text-muted-foreground"
      data-invite-clipboard={$view.clipboard.status}
    >
      {inModal && $view.clipboard.status === "copied"
        ? `${vb.t("Copiado")} ✓`
        : $view.clipboard.status === "failed"
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
  <div class="tw:space-y-2">
    <div class="tw:flex tw:items-start tw:gap-2" data-person={email}>
      {#if room.pending?.includes(email)}<Avatar
          name={vb.name(email)}
          src={avatarUrl(email)}
          seed={email}
        />{:else}{@const online = isOnline(email)}
        {#snippet face(props: Record<string, unknown>)}<button
            {...props}
            type="button"
            aria-label={`${label(email)} · ${online ? vb.t("Online") : vb.t("Offline")}`}
            data-presence={online ? "online" : "offline"}
            class="tw:relative tw:inline-flex tw:shrink-0 tw:cursor-default tw:rounded-full tw:border-0 tw:bg-transparent tw:p-0 tw:focus-visible:outline-2 tw:focus-visible:outline-offset-2 tw:focus-visible:outline-ring"
            ><Avatar
              name={vb.name(email)}
              src={avatarUrl(email)}
              seed={email}
            /><span
              data-status-dot={online ? "online" : "offline"}
              class={online
                ? "tw:absolute tw:-right-0.5 tw:-bottom-0.5 tw:size-2.5 tw:rounded-full tw:bg-success tw:ring-2 tw:ring-sidebar"
                : "tw:absolute tw:-right-0.5 tw:-bottom-0.5 tw:size-2.5 tw:rounded-full tw:bg-muted-foreground tw:ring-2 tw:ring-sidebar"}
            ></span></button
          >{/snippet}
        <Tip
          side="top"
          tap
          label={online ? vb.t("Online") : vb.t("Offline")}
          trigger={face}
        />{/if}
      <div class="tw:min-w-0 tw:flex-1 tw:space-y-1">
        <p
          class="tw:m-0 tw:break-words tw:text-sm tw:font-medium"
          title={email}
        >
          {room.names?.[email] || vb.name(email)}
        </p>
        <p class="tw:m-0 tw:break-all tw:text-xs tw:text-muted-foreground">
          {email}
        </p>
        {#if room.pending?.includes(email)}
          <Badge>{vb.t("pendente")}</Badge>
          <div class="tw:flex tw:flex-wrap tw:gap-1">
            <Button
              size="sm"
              variant="ghost"
              data-copyinv={email}
              title={vb.t(
                "Copiar a mensagem de convite (link da sala + setup do agent) para mandar no WhatsApp",
              )}
              onclick={() => copy(email)}>{vb.t("copiar")}</Button
            >
            <Button
              size="sm"
              variant="ghost"
              data-resend={email}
              disabled={!!$view.pending[email]}
              onclick={() => {
                void session.mutate("resend", email, request || http);
              }}>{vb.t("reenviar")}</Button
            >
          </div>
        {/if}
      </div>
      {#if canRemove(room, email)}<IconButton
          icon="close"
          data-remove={email}
          label={room.pending?.includes(email)
            ? vb.t("Cancelar convite")
            : vb.t("Remover {email}", { email })}
          disabled={!!$view.pending[email]}
          onclick={(event) => confirm(email, "remove", event.currentTarget)}
        />{/if}
    </div>
    {@render agents?.(email)}
  </div>
{/snippet}
<section
  bind:this={root}
  tabindex="-1"
  data-vb-native
  data-people-panel
  class="tw:max-h-[32%] tw:shrink-0 tw:space-y-3 tw:overflow-x-hidden tw:overflow-y-auto tw:overscroll-contain tw:border-t tw:border-border tw:px-3 tw:pt-0 tw:pb-3 tw:font-sans tw:text-sm tw:text-foreground"
>
  <SectionHeader title={vb.t("Pessoas e agents")} count={everyone.length}>
    {#snippet action()}<IconButton
        icon="plus"
        tip="bottom"
        label={vb.t("Convidar")}
        aria-haspopup="dialog"
        aria-expanded={inviting}
        data-invite-toggle
        bind:ref={toggle}
        onclick={openInvite}
      />{/snippet}
  </SectionHeader>
  {#if room.requests?.length}<div class="tw:space-y-3">
      <SectionHeader
        title={vb.t("Pedindo pra entrar")}
        level={4}
        sticky={false}
      />
      {#each room.requests as access (access.email)}<div
          class="tw:flex tw:items-start tw:gap-2"
          data-access-request={access.email}
        >
          <Avatar
            name={access.name || access.email}
            src={avatarUrl(access.email)}
            seed={access.email}
          />
          <div class="tw:min-w-0 tw:flex-1 tw:space-y-1">
            <p class="tw:m-0 tw:break-words tw:font-medium">
              {access.name || access.email}
            </p>
            <p class="tw:m-0 tw:break-all tw:text-xs tw:text-muted-foreground">
              {access.email} · {vb.t("pediu {ago}", { ago: vb.ago(access.ts) })}
            </p>
            <Button
              size="sm"
              variant="outline"
              data-ask={access.email}
              data-ok="1"
              disabled={!!$view.pending[access.email]}
              onclick={() => {
                void session.mutate("approve", access.email, request || http);
              }}>{vb.t("liberar")}</Button
            >
          </div>
          <IconButton
            icon="close"
            data-ask={access.email}
            data-ok=""
            label={vb.t("Recusar {email}", { email: access.email })}
            disabled={!!$view.pending[access.email]}
            onclick={(event) =>
              confirm(access.email, "deny", event.currentTarget)}
          />
        </div>{/each}
    </div>{/if}
  <div class="tw:space-y-3">
    {#each everyone as email (email)}{@render member(email)}{/each}
  </div>
  {#if !inviting}{@render outcomes(false)}{/if}
</section>
<AlertDialog
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
{#snippet marked(text: string, match: { start: number; end: number } | null)}
  {#if match}{text.slice(0, match.start)}<mark
      class="tw:rounded-sm tw:bg-primary/15 tw:font-semibold tw:text-inherit"
      >{text.slice(match.start, match.end)}</mark
    >{text.slice(match.end)}{:else}{text}{/if}
{/snippet}
{#snippet rowError(email: string)}
  {#if $view.issues[email]}<span
      role="alert"
      class="tw:block tw:whitespace-pre-wrap tw:break-words tw:text-xs tw:text-destructive"
      >{issueText($view.issues[email])}</span
    >{/if}
{/snippet}
{#snippet checkmark(on: boolean)}
  <span
    aria-hidden="true"
    data-invite-tick={on ? "on" : "off"}
    class={[
      "tw:inline-grid tw:size-5 tw:shrink-0 tw:place-items-center tw:rounded-full tw:transition-colors tw:motion-reduce:transition-none",
      on
        ? "tw:bg-primary tw:text-primary-foreground"
        : "tw:border tw:border-input tw:text-transparent",
    ]}><Icon name="check" class="tw:size-3" /></span
  >
{/snippet}
{#snippet mailAvatar()}
  <span
    aria-hidden="true"
    class="tw:inline-grid tw:size-8 tw:shrink-0 tw:place-items-center tw:rounded-full tw:bg-highlight tw:text-link"
    ><Icon name="mail" /></span
  >
{/snippet}
{#snippet sentRow(email: string)}
  {@const state = rowState(email)}
  <div
    class="tw:flex tw:items-center tw:gap-3 tw:rounded-control tw:px-2 tw:py-2"
    data-invite-sent={email}
  >
    {#if friends.includes(email) || room.names?.[email]}<Avatar
        name={label(email)}
        src={avatarUrl(email)}
        seed={email}
      />{:else}{@render mailAvatar()}{/if}
    <span class="tw:min-w-0 tw:flex-1">
      <span class="tw:block tw:truncate tw:font-medium">{label(email)}</span>
      <span class="tw:block tw:truncate tw:text-xs tw:text-muted-foreground"
        >{email}</span
      >
      {#if state === "error"}{@render rowError(email)}{/if}
    </span>
    {#if state === "pending" || state === "unconfirmed"}<span
        class="tw:shrink-0 tw:text-xs tw:text-muted-foreground"
        data-invite-state={state}
        >{state === "pending"
          ? vb.t("Convidando…")
          : vb.t("Aguardando confirmação…")}</span
      >{:else if state === "cancelled"}<span
        class="tw:shrink-0 tw:text-xs tw:text-muted-foreground"
        data-invite-state="cancelled">{vb.t("Convite cancelado")}</span
      >{:else if state === "error" || state === "idle"}<Button
        size="sm"
        variant="outline"
        data-retry={email}
        onclick={() => retry(email)}>{vb.t("Tentar de novo")}</Button
      >{:else}<span class="tw:sr-only" data-invite-state={state}
        >{vb.t("Convidado ✓")}</span
      ><a
        class={buttonVariants({ size: "icon", variant: "ghost" })}
        href={whatsappLink(inviteMessage(room, email, origin, vb.t))}
        target="_blank"
        rel="noopener noreferrer"
        data-invite-whatsapp={email}
        aria-label={vb.t("Mandar no WhatsApp para {name}", {
          name: label(email),
        })}
        title={vb.t("Mandar no WhatsApp para {name}", { name: label(email) })}
        ><Icon name="whatsapp" class="tw:text-success" /></a
      ><IconButton
        icon="copy"
        data-copyinv={email}
        label={vb.t("Copiar a mensagem para {name}", { name: label(email) })}
        onclick={() => copy(email)}
      />{/if}
  </div>
{/snippet}
<Dialog
  bind:open={inviting}
  sheet={phone.current}
  class={phone.current ? "tw:h-[90dvh]" : "tw:h-[min(36rem,90dvh)]"}
  title={vb.t("Convidar para {title}", { title: room.book.title })}
  closeLabel={vb.t("Fechar")}
  initialFocus={() => search}
  returnFocus={() => (toggle?.isConnected ? toggle : root)}
>
  <div
    id="invite"
    data-invite-modal
    class="tw:-mt-1 tw:flex tw:min-h-0 tw:flex-1 tw:flex-col tw:gap-3"
  >
    {#if sent}<div
        class="tw:-mx-2 tw:min-h-0 tw:flex-1 tw:space-y-3 tw:overflow-y-auto tw:overscroll-contain"
        data-invite-done={sentSummary}
      >
        <div class="tw:flex tw:items-center tw:gap-3 tw:px-2" role="status">
          <span
            aria-hidden="true"
            class={[
              "tw:inline-grid tw:size-9 tw:shrink-0 tw:place-items-center tw:rounded-full",
              sentSummary === "partial"
                ? "tw:bg-destructive/10 tw:text-destructive"
                : "tw:bg-success/15 tw:text-success",
            ]}
            ><Icon
              name={sentSummary === "partial" ? "warning" : "check"}
            /></span
          >
          <span class="tw:min-w-0">
            <span class="tw:block tw:font-medium"
              >{sentSummary === "sending"
                ? vb.t("Enviando convites…")
                : sentSummary === "partial"
                  ? vb.t("Alguns convites não foram. Tente de novo:")
                  : sent.length > 1
                    ? vb.t("{n} convites enviados", { n: sent.length })
                    : vb.t("Convite enviado")}</span
            >
            {#if sentSummary !== "partial"}<span
                class="tw:block tw:text-xs tw:text-muted-foreground"
                >{vb.t(
                  "Chegou um email com o link. Avise no WhatsApp também:",
                )}</span
              >{/if}
          </span>
        </div>
        <div>
          {#each sent as email (email)}{@render sentRow(email)}{/each}
        </div>
        <Button
          size="sm"
          variant="outline"
          class="tw:mx-2"
          data-invite-more
          bind:ref={more}
          onclick={inviteMore}
          ><Icon name="plus" class="tw:size-3.5" />{vb.t(
            "Convidar mais gente",
          )}</Button
        >
      </div>{:else}
      <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
      <div
        class="tw:relative tw:flex tw:min-h-9 tw:cursor-text tw:flex-wrap tw:items-center tw:gap-1.5 tw:rounded-control tw:border tw:border-input tw:bg-studio-input-background tw:py-1 tw:pr-2 tw:pl-9 tw:focus-within:border-ring tw:focus-within:ring-2 tw:focus-within:ring-ring/30"
        data-invite-field
        onclick={(event) => {
          if (event.target === event.currentTarget) search?.focus();
        }}
      >
        <Icon
          name="search"
          class="tw:pointer-events-none tw:absolute tw:top-2.5 tw:left-3 tw:size-4 tw:text-muted-foreground"
        />
        {#if selected.length}<ul
            class="tw:m-0 tw:contents tw:list-none tw:p-0"
            aria-label={vb.t("Pessoas para convidar")}
          >
            {#each selected as email (email)}<li
                class="tw:inline-flex tw:h-7 tw:max-w-full tw:items-center tw:gap-1.5 tw:rounded-full tw:bg-muted tw:py-0 tw:pr-0.5 tw:pl-0.5 tw:text-sm tw:font-medium"
                data-invite-chip={email}
              >
                {#if friends.includes(email)}<Avatar
                    name={label(email)}
                    src={avatarUrl(email)}
                    seed={email}
                    px={24}
                    class="tw:text-[0.625rem]"
                  />{:else}<span
                    aria-hidden="true"
                    class="tw:inline-grid tw:size-6 tw:shrink-0 tw:place-items-center tw:rounded-full tw:bg-highlight tw:text-link"
                    ><Icon name="mail" class="tw:size-3.5" /></span
                  >{/if}
                <span class="tw:min-w-0 tw:truncate"
                  >{friends.includes(email)
                    ? label(email).split(" ")[0]
                    : email}</span
                >
                <button
                  type="button"
                  class="tw:inline-grid tw:size-6 tw:shrink-0 tw:cursor-pointer tw:place-items-center tw:rounded-full tw:border-0 tw:bg-transparent tw:p-0 tw:text-muted-foreground tw:hover:bg-accent tw:hover:text-foreground"
                  aria-label={vb.t("Tirar {name}", { name: label(email) })}
                  onclick={() => unpick(email)}
                  ><Icon name="close" class="tw:size-3.5" /></button
                >
              </li>{/each}
          </ul>{/if}
        <input
          type="search"
          bind:this={search}
          class="tw:h-7 tw:min-w-32 tw:flex-1 tw:border-0 tw:bg-transparent tw:p-0 tw:font-sans tw:text-sm tw:text-foreground tw:outline-none tw:placeholder:text-muted-foreground"
          role="combobox"
          aria-expanded="true"
          aria-autocomplete="list"
          aria-controls={`${ids}-options`}
          aria-activedescendant={active >= 0 ? optionId(active) : undefined}
          aria-label={vb.t("Buscar amigos ou digitar um email…")}
          placeholder={selected.length
            ? vb.t("Adicionar mais…")
            : vb.t("Buscar amigos ou digitar um email…")}
          autocomplete="off"
          autocapitalize="none"
          spellcheck={false}
          enterkeyhint={selected.length && !query ? "send" : "done"}
          value={$view.draft}
          oninput={(event) => session.edit(event.currentTarget.value)}
          onkeydown={onSearchKey}
        />
      </div>
      <!-- A fixed-height results area: the search stays put while the list changes. -->
      <div
        class="tw:-mx-2 tw:min-h-0 tw:flex-1 tw:overflow-y-auto tw:overscroll-contain"
      >
        <div
          bind:this={list}
          id={`${ids}-options`}
          role="listbox"
          aria-multiselectable="true"
          aria-label={vb.t("Seus amigos")}
        >
          {#if emailRow}<div
              id={optionId(0)}
              role="option"
              aria-selected={selected.includes(emailRow)}
              tabindex="-1"
              data-invite-email={emailRow}
              data-active={active === 0 ? "" : undefined}
              class={[
                "tw:flex tw:cursor-pointer tw:items-center tw:gap-3 tw:rounded-control tw:px-2 tw:py-2",
                active === 0 && "tw:bg-accent",
              ]}
              onpointermove={() => {
                active = 0;
                viaKeys = false;
              }}
              onmousedown={(event) => event.preventDefault()}
              onclick={() => pick(emailRow)}
              onkeydown={(event) => optionKey(event, emailRow)}
            >
              {@render mailAvatar()}
              <span class="tw:min-w-0 tw:flex-1">
                <span class="tw:block tw:break-all tw:font-medium"
                  >{vb.t("Convidar {email}", { email: emailRow })}</span
                >
                {@render rowError(emailRow)}
              </span>
              {@render checkmark(selected.includes(emailRow))}
            </div>{:else if memberRow}<div
              role="option"
              aria-selected="false"
              aria-disabled="true"
              data-invite-member={memberRow}
              class="tw:flex tw:items-center tw:gap-3 tw:rounded-control tw:px-2 tw:py-2"
            >
              <Avatar
                name={label(memberRow)}
                src={avatarUrl(memberRow)}
                seed={memberRow}
              />
              <span class="tw:min-w-0 tw:flex-1">
                <span class="tw:block tw:truncate tw:font-medium"
                  >{label(memberRow)}</span
                >
                <span
                  class="tw:block tw:truncate tw:text-xs tw:text-muted-foreground"
                  >{memberRow}</span
                >
              </span>
              {#if rowState(memberRow) === "invited"}<span
                  class="tw:shrink-0 tw:text-xs tw:font-medium tw:text-foreground"
                  data-invite-state="invited">{vb.t("Convidado ✓")}</span
                >{:else}<span
                  class="tw:shrink-0 tw:text-xs tw:text-muted-foreground"
                  data-invite-state="member">{vb.t("na sala")}</span
                >{/if}
            </div>{/if}
          {#if friendRows.length}<div
              role="group"
              aria-labelledby={`${ids}-friends-label`}
            >
              <p
                id={`${ids}-friends-label`}
                class="tw:m-0 tw:px-2 tw:pt-1 tw:pb-1 tw:text-xs tw:font-medium tw:uppercase tw:tracking-wide tw:text-muted-foreground"
              >
                {vb.t("Seus amigos")} · {friendRows.length}
              </p>
              {#each friendRows as row, index (row.email)}
                {@const position = index + (emailRow ? 1 : 0)}
                <div
                  id={optionId(position)}
                  role="option"
                  aria-selected={selected.includes(row.email)}
                  tabindex="-1"
                  data-friend={row.email}
                  data-active={active === position ? "" : undefined}
                  class={[
                    "tw:flex tw:cursor-pointer tw:items-center tw:gap-3 tw:rounded-control tw:px-2 tw:py-2",
                    active === position && "tw:bg-accent",
                  ]}
                  onpointermove={() => {
                    active = position;
                    viaKeys = false;
                  }}
                  onmousedown={(event) => event.preventDefault()}
                  onclick={() => pick(row.email)}
                  onkeydown={(event) => optionKey(event, row.email)}
                >
                  <Avatar
                    name={row.name}
                    src={avatarUrl(row.email)}
                    seed={row.email}
                  />
                  <span class="tw:min-w-0 tw:flex-1">
                    <span class="tw:block tw:truncate tw:font-medium"
                      >{@render marked(row.name, row.nameMatch)}</span
                    >
                    <span
                      class="tw:block tw:truncate tw:text-xs tw:text-muted-foreground"
                      >{@render marked(row.email, row.emailMatch)}</span
                    >
                    {@render rowError(row.email)}
                  </span>
                  {@render checkmark(selected.includes(row.email))}
                </div>
              {/each}
            </div>{/if}
        </div>
        {#if friendRows.length}{:else if query && !emailRow && !memberRow}<p
            class="tw:m-0 tw:px-2 tw:py-3 tw:text-sm tw:text-muted-foreground"
          >
            {vb.t(
              'Nenhum amigo encontrado para "{q}". Digite um email completo para convidar alguém novo.',
              { q: query },
            )}
          </p>{:else if !query}<p
            class="tw:m-0 tw:px-2 tw:py-3 tw:text-sm tw:text-muted-foreground"
          >
            {vb.t("Digite um email completo para convidar alguém.")}
          </p>{/if}
      </div>{/if}
    <div
      class="tw:-mx-6 tw:-mb-2 tw:space-y-3 tw:border-t tw:border-border tw:px-6 tw:pt-3"
    >
      <div class="tw:flex tw:flex-wrap tw:items-center tw:gap-2">
        <span class="tw:mr-auto tw:text-xs tw:text-muted-foreground"
          >{vb.t("Ou mande o link da sala")}</span
        >
        <a
          class={buttonVariants({ size: "sm", variant: "outline" })}
          href={whatsappLink(shareMessage(room, origin, vb.t))}
          target="_blank"
          rel="noopener noreferrer"
          data-invite-share="whatsapp"
          title={vb.t("Mandar o link da sala no WhatsApp")}
          ><Icon name="whatsapp" class="tw:text-success" />{vb.t("WhatsApp")}</a
        >
        <Button
          size="sm"
          variant="outline"
          data-invite-share="link"
          onclick={copyLink}
          ><Icon name={linkCopy === "copied" ? "check" : "link"} />{linkCopy ===
          "copied"
            ? vb.t("Link copiado ✓")
            : vb.t("Copiar link")}</Button
        >
      </div>
      <p
        role="status"
        data-invite-link-status={linkCopy ?? undefined}
        class={linkCopy === "failed"
          ? "tw:m-0 tw:text-xs tw:text-destructive"
          : "tw:sr-only"}
      >
        {linkCopy === "failed"
          ? vb.t("Não consegui copiar o link.")
          : linkCopy === "copied"
            ? vb.t("Link copiado ✓")
            : ""}
      </p>
      {#if !sent}<Button
          class="tw:w-full"
          data-invite-send
          disabled={!selected.length}
          onclick={sendAll}
          >{selected.length > 1
            ? vb.t("Enviar {n} convites", { n: selected.length })
            : vb.t("Enviar convite")}</Button
        >{/if}
      {@render outcomes(true)}
    </div>
  </div>
</Dialog>
