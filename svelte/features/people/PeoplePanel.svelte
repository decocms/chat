<script lang="ts">
  import { onDestroy, untrack, type Snippet } from "svelte";
  import { MediaQuery } from "svelte/reactivity";
  import {
    canRemove,
    canAct,
    findMatch,
    inviteMessage,
    isEmail,
    normalizeEmail,
    peopleModel,
    type PeopleRoom,
  } from "./model";
  import { createPeopleRequest, type PeopleRequest } from "./api";
  import { createPeopleSession } from "./session";
  import AlertDialog from "../../lib/ui/AlertDialog.svelte";
  import Avatar from "../../lib/ui/Avatar.svelte";
  import Badge from "../../lib/ui/Badge.svelte";
  import Button from "../../lib/ui/Button.svelte";
  import { buttonVariants } from "../../lib/ui/button";
  import Checkbox from "../../lib/ui/Checkbox.svelte";
  import Dialog from "../../lib/ui/Dialog.svelte";
  import Icon from "../../lib/ui/Icon.svelte";
  import IconButton from "../../lib/ui/IconButton.svelte";
  import Input from "../../lib/ui/Input.svelte";
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
  /** The invite modal: search your friends, or type an email. */
  let inviting = $state(false),
    toggle = $state<HTMLButtonElement | null>(null),
    search = $state<HTMLInputElement | null>(null),
    list = $state<HTMLElement | null>(null),
    /** Friends invited since the modal opened keep their row to show the outcome. */
    touched = $state<string[]>([]),
    active = $state(-1);
  const phone = new MediaQuery("(max-width: 639px)");
  const COPY_KEY = "vb.inviteCopy";
  let copyInvite = $state(readCopyChoice());
  function readCopyChoice() {
    try {
      return localStorage.getItem(COPY_KEY) !== "0";
    } catch {
      return true;
    }
  }
  function saveCopyChoice(value: boolean) {
    try {
      localStorage.setItem(COPY_KEY, value ? "1" : "0");
    } catch {
      // Private mode or blocked storage: the choice lasts until reload.
    }
  }
  const query = $derived($view.draft.trim());
  const typedEmail = $derived(normalizeEmail($view.draft));
  const friendRows = $derived(
    friends
      .filter(
        (email) => !room.members.includes(email) || touched.includes(email),
      )
      .map((email) => {
        const name = room.names?.[email] || vb.name(email);
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
    typedUnlisted &&
      room.members.includes(typedUnlisted) &&
      !touched.includes(typedUnlisted)
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
  type RowState = "idle" | "pending" | "error" | "invited" | "member";
  function rowState(email: string): RowState {
    if ($view.issues[email]) return "error";
    if ($view.pending[email]) {
      // The server accepted it (notice) and the room has not shown the pending row yet.
      const notice = $view.notices[email];
      return notice === "invite" || notice === "resend" ? "invited" : "pending";
    }
    if (room.pending?.includes(email)) return "invited";
    if (room.members.includes(email)) return "member";
    return "idle";
  }
  /** Rows show their own outcome; the outcome area leaves those out while the modal is open. */
  const rowEmails = $derived(
    new Set([...options, ...(memberRow ? [memberRow] : [])]),
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
    touched = [];
    session.edit("");
    active = -1;
    inviting = true;
  }
  async function add(email: string) {
    const state = rowState(email);
    if (state !== "idle" && state !== "error") return;
    const before = $view.draft;
    if (!touched.includes(email)) touched = [...touched, email];
    search?.focus();
    const success = await invite(email);
    // Clear the search for the next person, unless it was edited meanwhile.
    if (success && $view.draft === before) {
      session.edit("");
      active = -1;
    }
  }
  /** Options stay out of the tab order (the search owns the keyboard), but answer keys if focused. */
  function optionKey(event: KeyboardEvent, email: string) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    void add(email);
  }
  function onSearchKey(event: KeyboardEvent) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!options.length) return;
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      active =
        active < 0
          ? step > 0
            ? 0
            : options.length - 1
          : (active + step + options.length) % options.length;
    } else if (event.key === "Enter") {
      // The Enter that confirms an IME composition is not an invite.
      if (event.isComposing || event.keyCode === 229) return;
      event.preventDefault();
      const email = options[active];
      if (email) void add(email);
      else if (isEmail(typedEmail)) void add(typedEmail);
    }
  }
  const everyone = $derived([...model.online, ...model.offline]);
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
  onDestroy(() => session.dispose());
  function copy(email: string) {
    const text = inviteMessage(room, email, location.origin, vb.t);
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
    // Copy synchronously to keep clipboard user activation; its result is separate from the HTTP invitation result.
    if (copyInvite && canAct(room, action, email)) copy(email);
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
      <Avatar name={vb.name(email)} src={avatarUrl(email)} />
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
        {:else}<Badge
            variant={room.online.includes(email) || email === room.me
              ? "success"
              : "neutral"}
            >{room.online.includes(email) || email === room.me
              ? vb.t("online")
              : vb.t("offline")}</Badge
          >{/if}
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
{#snippet rowAction(email: string, label: string)}
  {@const state = rowState(email)}
  {#if state === "pending"}<span
      class="tw:shrink-0 tw:text-xs tw:text-muted-foreground"
      data-invite-state="pending">{vb.t("Convidando…")}</span
    >{:else if state === "invited"}<span
      class="tw:shrink-0 tw:text-xs tw:font-medium tw:text-foreground"
      data-invite-state="invited">{vb.t("Convidado ✓")}</span
    >{:else if state === "member"}<span
      class="tw:shrink-0 tw:text-xs tw:text-muted-foreground"
      data-invite-state="member">{vb.t("na sala")}</span
    >{:else}<!-- Not a button: the option itself is the keyboard target (no nested interactive control). -->
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <span
      class={buttonVariants({
        size: "sm",
        variant: state === "error" ? "outline" : "secondary",
      })}
      data-add={email}
      onclick={(event) => {
        event.stopPropagation();
        void add(email);
      }}
      >{#if state === "error"}{vb.t("Tentar de novo")}{:else}<Icon
          name="plus"
          class="tw:size-3.5"
        />{label}{/if}</span
    >{/if}
{/snippet}
{#snippet rowError(email: string)}
  {#if $view.issues[email]}<span
      role="alert"
      class="tw:block tw:whitespace-pre-wrap tw:break-words tw:text-xs tw:text-destructive"
      >{issueText($view.issues[email])}</span
    >{/if}
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
    <div class="tw:relative">
      <Icon
        name="search"
        class="tw:pointer-events-none tw:absolute tw:top-1/2 tw:left-3 tw:size-4 tw:-translate-y-1/2 tw:text-muted-foreground"
      />
      <Input
        type="search"
        bind:ref={search}
        class="tw:pl-9"
        role="combobox"
        aria-expanded="true"
        aria-autocomplete="list"
        aria-controls={`${ids}-options`}
        aria-activedescendant={active >= 0 ? optionId(active) : undefined}
        aria-label={vb.t("Buscar amigos ou digitar um email…")}
        placeholder={vb.t("Buscar amigos ou digitar um email…")}
        autocomplete="off"
        autocapitalize="none"
        spellcheck={false}
        enterkeyhint="send"
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
        aria-label={vb.t("Seus amigos")}
      >
        {#if emailRow}<div
            id={optionId(0)}
            role="option"
            aria-selected={active === 0}
            tabindex="-1"
            data-invite-email={emailRow}
            class={[
              "tw:flex tw:cursor-pointer tw:items-center tw:gap-3 tw:rounded-control tw:px-2 tw:py-2",
              active === 0 && "tw:bg-accent",
            ]}
            onpointermove={() => (active = 0)}
            onmousedown={(event) => event.preventDefault()}
            onclick={() => void add(emailRow)}
            onkeydown={(event) => optionKey(event, emailRow)}
          >
            <span
              aria-hidden="true"
              class="tw:inline-grid tw:size-8 tw:shrink-0 tw:place-items-center tw:rounded-full tw:border tw:border-border tw:bg-muted"
              >✉</span
            >
            <span class="tw:min-w-0 tw:flex-1">
              <span class="tw:block tw:break-all tw:font-medium"
                >{vb.t("Convidar {email}", { email: emailRow })}</span
              >
              {@render rowError(emailRow)}
            </span>
            {@render rowAction(emailRow, vb.t("Convidar"))}
          </div>{:else if memberRow}<div
            role="option"
            aria-selected="false"
            aria-disabled="true"
            data-invite-member={memberRow}
            class="tw:flex tw:items-center tw:gap-3 tw:rounded-control tw:px-2 tw:py-2"
          >
            <Avatar
              name={room.names?.[memberRow] || vb.name(memberRow)}
              src={avatarUrl(memberRow)}
            />
            <span class="tw:min-w-0 tw:flex-1">
              <span class="tw:block tw:truncate tw:font-medium"
                >{room.names?.[memberRow] || vb.name(memberRow)}</span
              >
              <span
                class="tw:block tw:truncate tw:text-xs tw:text-muted-foreground"
                >{memberRow}</span
              >
            </span>
            {@render rowAction(memberRow, "")}
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
                aria-selected={active === position}
                tabindex="-1"
                data-friend={row.email}
                class={[
                  "tw:flex tw:cursor-pointer tw:items-center tw:gap-3 tw:rounded-control tw:px-2 tw:py-2",
                  active === position && "tw:bg-accent",
                ]}
                onpointermove={() => (active = position)}
                onmousedown={(event) => event.preventDefault()}
                onclick={() => {
                  // Picking a row only highlights it: "+ Adicionar" or Enter sends the invite.
                  active = position;
                  search?.focus();
                }}
                onkeydown={(event) => optionKey(event, row.email)}
              >
                <Avatar name={row.name} src={avatarUrl(row.email)} />
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
                {@render rowAction(row.email, vb.t("Adicionar"))}
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
    </div>
    <div
      class="tw:-mx-6 tw:-mb-2 tw:space-y-2 tw:border-t tw:border-border tw:px-6 tw:pt-3"
    >
      <label
        class="tw:flex tw:cursor-pointer tw:items-center tw:gap-2 tw:text-sm"
      >
        <Checkbox
          bind:checked={copyInvite}
          data-invite-copy
          onCheckedChange={saveCopyChoice}
        />
        {vb.t("Copiar uma mensagem de WhatsApp com o link")}
      </label>
      {@render outcomes(true)}
    </div>
  </div>
</Dialog>
