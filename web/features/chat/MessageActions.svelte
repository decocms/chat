<script lang="ts">
  import { onDestroy } from "svelte";
  import type {
    ChatMessage,
    ChatActions,
    ChatBridge,
  } from "../../app/chatTypes";
  import Button from "../../lib/studio/Button.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import type { IconName } from "../../lib/studio/icons";
  import IconButton from "../../lib/studio/IconButton.svelte";
  import TooltipProvider from "../../lib/studio/TooltipProvider.svelte";
  import { cn } from "../../lib/studio/utils";
  import { copyChatText } from "./clipboard";
  import EmojiPicker from "../composer/EmojiPicker.svelte";
  import ConfirmDialog from "../../lib/components/ConfirmDialog.svelte";
  import Dialog from "../../lib/studio/Dialog.svelte";
  import DialogContent from "../../lib/studio/DialogContent.svelte";
  import DialogHeader from "../../lib/studio/DialogHeader.svelte";
  import DialogTitle from "../../lib/studio/DialogTitle.svelte";
  import Drawer from "../../lib/studio/Drawer.svelte";
  import DrawerContent from "../../lib/studio/DrawerContent.svelte";
  import SheetTitle from "../../lib/studio/SheetTitle.svelte";
  import type { MessageVersion } from "../../../shared/room";
  import { OWN_REACTION, QUICK_REACTIONS, toolbarReactions } from "./reactions";
  import { startEditing } from "./editing";
  import DropdownMenu from "../../lib/studio/DropdownMenu.svelte";
  import DropdownMenuContent from "../../lib/studio/DropdownMenuContent.svelte";
  import DropdownMenuItem from "../../lib/studio/DropdownMenuItem.svelte";
  import DropdownMenuSeparator from "../../lib/studio/DropdownMenuSeparator.svelte";
  import DropdownMenuTrigger from "../../lib/studio/DropdownMenuTrigger.svelte";
  import { studioType } from "../../lib/components/type";
  /** Every item of the hover bar: one round 28px button, centred on the bar's axis. */
  const BAR_ITEM = "rounded-full text-muted-foreground hover:text-foreground";
  let {
    message,
    roomId,
    actions,
    vb,
    showLink = true,
    floating = false,
    canReact = false,
    me = "",
    onthread,
    threadOpen = false,
    canEdit = false,
    canDelete = false,
    history,
    onforward,
    sheet = $bindable(false),
  }: {
    message: ChatMessage;
    roomId: string;
    actions: ChatActions;
    vb: ChatBridge;
    showLink?: boolean;
    /** The hover toolbar: on the name row of a message that has one (the row is short), else just above the message,
     * over the one before it, never over the text you point at; status lines stay in the flow. */
    floating?: boolean;
    /** Offer the suggested reactions (not on @vibe notices, issues or reminders). */
    canReact?: boolean;
    /** Who is looking, to mark the quick reactions they already gave. */
    me?: string;
    /** "Criar thread" (Gimenes #4310): makes the thread from this message and opens it. None: the message cannot
     *  start one. */
    onthread?: () => void;
    /** The message already has a thread: the action opens it ("Abrir thread"). */
    threadOpen?: boolean;
    /** Your own message (Gui #4276): you can change its text, in place (MessageEditor). */
    canEdit?: boolean;
    /** Yours, or any message when you own the room. */
    canDelete?: boolean;
    /** Room owner on an edited/deleted message: its earlier versions (null until asked for). */
    history?: MessageVersion[] | null;
    /** "Encaminhar" (forward, like WhatsApp): selection mode starts with this message picked. None: it cannot be
     *  forwarded. */
    onforward?: () => void;
    /** The phone's actions sheet (Gimenes #4402): holding a message opens it, from the bottom, with every action the
     *  hover toolbar has. */
    sheet?: boolean;
  } = $props();
  let sheetBox = $state<HTMLElement | null>(null);
  /** A row of the sheet: it closes the sheet, then acts. */
  function fromSheet(act: () => void) {
    sheet = false;
    act();
  }
  let deleting = $state(false),
    showingHistory = $state(false),
    busy = $state(false),
    error = $state("");
  async function remove() {
    if (!active || busy) return;
    busy = true;
    error = "";
    const r = await actions.request({ t: "msg.delete", id: message.id });
    if (!active) return;
    busy = false;
    if (!r.ok) error = r.error;
    else deleting = false;
  }
  function edit() {
    if (active) startEditing(roomId, message.id);
  }
  function openHistory() {
    if (!active) return;
    showingHistory = true;
    void actions.request({ t: "msg.history", id: message.id });
  }
  const mine = (emoji: string) =>
    !!me && (message.reactions?.[emoji] ?? []).includes(me);
  // The full emoji picker, past the quick ones (like Discord's and Slack's "add reaction").
  let picking = $state(false);
  function react(emoji: string) {
    if (!active) return;
    void actions.request({ t: "react", id: message.id, emoji });
  }
  type Action = {
    key:
      | "reply"
      | "thread"
      | "forward"
      | "text"
      | "link"
      | "edit"
      | "history"
      | "delete";
    icon: IconName;
    label: string;
    data: Record<string, string | number | undefined>;
    run: () => void;
  };
  /** Every action this message has, in the menu's order. */
  const all = $derived.by((): Action[] => {
    const list: (Action | false)[] = [
      {
        key: "reply",
        icon: "reverse-left",
        label: vb.t("Responder"),
        data: { "data-reply": message.id },
        run: () => actions.reply(message.id),
      },
      !!onthread && {
        key: "thread",
        icon: "git-branch-01",
        label: threadOpen ? vb.t("Abrir thread") : vb.t("Criar thread"),
        data: threadOpen
          ? { "data-open-thread": message.id }
          : { "data-start-thread": message.id },
        run: () => onthread?.(),
      },
      !!onforward && {
        key: "forward",
        icon: "share-06",
        label: vb.t("Encaminhar"),
        data: { "data-forward": message.id },
        run: () => onforward?.(),
      },
      {
        key: "text",
        icon: copied === "text" ? "check" : "copy-01",
        label: copied === "text" ? vb.t("Copiado") : vb.t("Copiar texto"),
        data: { "data-copy": message.id },
        run: () => void copy(),
      },
      showLink && {
        key: "link",
        icon: copied === "link" ? "check" : "link-01",
        label: copied === "link" ? vb.t("Copiado") : vb.t("Copiar link"),
        data: { "data-copylink": message.id },
        run: () => void copy(true),
      },
      canEdit && {
        key: "edit",
        icon: "pencil-01",
        label: vb.t("Editar mensagem"),
        data: { "data-edit-message": message.id },
        run: edit,
      },
      history !== undefined && {
        key: "history",
        icon: "clock",
        label: vb.t("Ver histórico da mensagem"),
        data: { "data-message-history": message.id },
        run: openHistory,
      },
      canDelete && {
        key: "delete",
        icon: "trash-01",
        label: vb.t("Apagar mensagem"),
        data: { "data-delete-message": message.id },
        run: () => {
          error = "";
          deleting = true;
        },
      },
    ];
    return list.filter((a): a is Action => !!a);
  });
  // Yours: reply, edit, forward, thread. Someone else's: reply, forward, copy (Valls).
  const BAR_KEYS = $derived<Action["key"][]>(
    !!me && message.author === me
      ? ["reply", "edit", "forward", "thread"]
      : ["reply", "forward", "text"],
  );
  const barActions = $derived(
    BAR_KEYS.flatMap((key) => all.filter((a) => a.key === key)),
  );
  /** The rest, in the menu's order, then delete alone at the bottom, in red, after a divider (Gimenes #4591). */
  const menuGroups = $derived(
    [
      all.filter((a) => a.key !== "delete" && !BAR_KEYS.includes(a.key)),
      all.filter((a) => a.key === "delete"),
    ].filter((group) => group.length),
  );
  let menuOpen = $state(false);
  let issue = $state<"empty" | "clipboard" | null>(null),
    copied = $state<"text" | "link" | null>(null),
    retryLink = $state(false);
  let active = true,
    sequence = 0,
    reset: ReturnType<typeof setTimeout> | undefined;
  onDestroy(() => {
    active = false;
    sequence++;
    clearTimeout(reset);
  });
  export async function copy(link = false) {
    if (!active) return;
    retryLink = link;
    const token = ++sequence;
    issue = null;
    copied = null;
    clearTimeout(reset);
    const text = link
      ? `${location.origin}/b/${roomId}${message.thread && message.thread !== "main" ? `?t=${encodeURIComponent(message.thread)}` : ""}#m${message.id}`
      : message.text || message.files?.map((f) => f.name).join("\n") || "";
    if (!text) {
      issue = "empty";
      return;
    }
    try {
      await copyChatText(text);
      if (active && token === sequence) {
        // The button itself says it: its icon turns into ✓ and its tooltip reads "Copied", for a moment.
        copied = link ? "link" : "text";
        navigator.vibrate?.(15);
        reset = setTimeout(() => {
          if (active && token === sequence) copied = null;
        }, 1500);
      }
    } catch {
      if (active && token === sequence) issue = "clipboard";
    }
  }
</script>

<div
  data-message-actions
  data-chat-hover-only={floating ? "" : undefined}
  class={floating ? "contents" : "flex flex-wrap items-center gap-1"}
>
  <div
    data-message-toolbar
    class={cn(
      "flex items-center gap-0.5",
      floating &&
        "pointer-events-none absolute -top-3 right-3 z-10 in-data-continuous:-top-8 origin-top-right translate-y-0.5 scale-[.98] rounded-full bg-card p-1 opacity-0 shadow-[var(--vb-shadow-edge),0_2px_8px_rgb(0_0_0/0.06)] transition-[opacity,translate,scale] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:scale-100 group-hover:opacity-100 group-has-focus-visible:pointer-events-auto group-has-focus-visible:translate-y-0 group-has-focus-visible:scale-100 group-has-focus-visible:opacity-100 motion-reduce:transition-none pointer-coarse:hidden",
      floating &&
        (menuOpen || picking) &&
        "pointer-events-auto translate-y-0 scale-100 opacity-100",
    )}
  >
    <TooltipProvider>
      <!-- Reactions sit with the actions, at the top (Valls): the three quick ones, then any other you gave, each
           pressed when it is yours (a click takes it back), then 🙂 for every emoji. Inline: the quick eight. -->
      {#if canReact}{#each floating ? toolbarReactions(message.reactions, me) : QUICK_REACTIONS as emoji (emoji)}<IconButton
            label={mine(emoji)
              ? vb.t("Tirar sua reação {emoji}", { emoji })
              : vb.t("Reagir com {emoji}", { emoji })}
            data-quick-react={emoji}
            aria-pressed={mine(emoji)}
            class={cn(
              "text-base leading-none",
              floating
                ? "rounded-full border border-solid border-transparent"
                : mine(emoji) && "bg-accent",
              floating && mine(emoji) && OWN_REACTION,
            )}
            onclick={() => react(emoji)}>{emoji}</IconButton
          >{/each}
        {#if floating}<EmojiPicker
            t={vb.t}
            bind:open={picking}
            onpick={(emoji) => react(emoji)}
            side="top"
            align="end"
            data-reactions-picker={String(message.id)}
          >
            {#snippet trigger(props)}<IconButton
                {...props}
                label={vb.t("Mais reações")}
                data-more-reactions={message.id}
                class="rounded-full text-muted-foreground hover:text-foreground data-[state=open]:bg-accent data-[state=open]:text-foreground"
                ><Icon icon="face-smile" size={16} /></IconButton
              >{/snippet}
          </EmojiPicker>{/if}
        <div
          aria-hidden="true"
          class="mx-0.5 h-4 w-px shrink-0 bg-border"
        ></div>{/if}
      {#if floating}<!-- Only the main actions in the bar (Valls): on your message reply, edit, forward, thread; on someone
           else's reply, forward, copy. Every other action is in ⋯, like Discord's message menu. -->
        {#each barActions as action (action.key)}<IconButton
            label={action.label}
            {...action.data}
            class={BAR_ITEM}
            onclick={() => {
              if (active) action.run();
            }}><Icon icon={action.icon} size={16} /></IconButton
          >{/each}
        {#if menuGroups.length}<DropdownMenu bind:open={menuOpen}>
            <DropdownMenuTrigger>
              {#snippet child({ props })}<IconButton
                  {...props}
                  label={copied && !barActions.some((a) => a.key === copied)
                    ? vb.t("Copiado")
                    : vb.t("Mais ações")}
                  data-more-actions={message.id}
                  class={cn(BAR_ITEM, "data-[state=open]:bg-accent")}
                  ><Icon
                    icon={copied && !barActions.some((a) => a.key === copied)
                      ? "check"
                      : "dots-horizontal"}
                    size={16}
                  /></IconButton
                >{/snippet}
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              sideOffset={6}
              data-message-menu={message.id}
              class={cn(studioType, "w-56")}
            >
              {#each menuGroups as group, i (group[0].key)}{#if i}<DropdownMenuSeparator
                  />{/if}{#each group as action (action.key)}<DropdownMenuItem
                    {...action.data}
                    variant={action.key === "delete"
                      ? "destructive"
                      : "default"}
                    onSelect={() => {
                      if (active) action.run();
                    }}
                    ><Icon icon={action.icon} />{action.label}</DropdownMenuItem
                  >{/each}{/each}
            </DropdownMenuContent>
          </DropdownMenu>{/if}
      {:else}
        <IconButton
          label={vb.t("Responder a esta mensagem")}
          data-reply={message.id}
          class={floating
            ? "rounded-full text-muted-foreground hover:text-foreground"
            : ""}
          onclick={() => {
            if (active) actions.reply(message.id);
          }}><Icon icon="reverse-left" size={16} /></IconButton
        >
        {#if onthread}<IconButton
            label={threadOpen ? vb.t("Abrir thread") : vb.t("Criar thread")}
            data-start-thread={threadOpen ? undefined : message.id}
            data-open-thread={threadOpen ? message.id : undefined}
            class={floating
              ? "rounded-full text-muted-foreground hover:text-foreground"
              : ""}
            onclick={() => {
              if (active) onthread?.();
            }}><Icon icon="git-branch-01" size={16} /></IconButton
          >{/if}
        {#if onforward}<IconButton
            label={vb.t("Encaminhar")}
            data-forward={message.id}
            class={floating
              ? "rounded-full text-muted-foreground hover:text-foreground"
              : ""}
            onclick={() => {
              if (active) onforward?.();
            }}><Icon icon="share-06" size={16} /></IconButton
          >{/if}
        <IconButton
          label={copied === "text"
            ? vb.t("Copiado")
            : vb.t("Copiar o texto desta mensagem")}
          data-copy={message.id}
          class={floating
            ? "rounded-full text-muted-foreground hover:text-foreground"
            : ""}
          onclick={() => {
            void copy();
          }}
          ><Icon
            icon={copied === "text" ? "check" : "copy-01"}
            size={16}
          /></IconButton
        >
        {#if canEdit}<IconButton
            label={vb.t("Editar mensagem")}
            data-edit-message={message.id}
            class={floating
              ? "rounded-full text-muted-foreground hover:text-foreground"
              : ""}
            onclick={edit}><Icon icon="pencil-01" size={16} /></IconButton
          >{/if}
        {#if history !== undefined}<IconButton
            label={vb.t("Ver histórico da mensagem")}
            data-message-history={message.id}
            class={floating
              ? "rounded-full text-muted-foreground hover:text-foreground"
              : ""}
            onclick={openHistory}><Icon icon="clock" size={16} /></IconButton
          >{/if}
        {#if showLink}<IconButton
            label={copied === "link"
              ? vb.t("Copiado")
              : vb.t("Copiar o link desta mensagem")}
            data-copylink={message.id}
            class={floating
              ? "rounded-full text-muted-foreground hover:text-foreground"
              : ""}
            onclick={() => {
              void copy(true);
            }}
            ><Icon
              icon={copied === "link" ? "check" : "link-01"}
              size={16}
            /></IconButton
          >{/if}
        <!-- Delete is last, red, after a divider: far from the actions people click often (Gimenes #4591). -->
        {#if canDelete}<div
            aria-hidden="true"
            class="mx-0.5 h-4 w-px shrink-0 bg-border"
          ></div>
          <IconButton
            label={vb.t("Apagar mensagem")}
            data-delete-message={message.id}
            class={floating
              ? "rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
              : "text-destructive hover:text-destructive"}
            onclick={() => {
              error = "";
              deleting = true;
            }}><Icon icon="trash-01" size={16} /></IconButton
          >{/if}
      {/if}
    </TooltipProvider>
  </div>
  <!-- Floating toolbar: the button shows it (✓ + tooltip), this is for screen readers. Inline (phones): a word. -->
  {#if copied}<span
      role="status"
      class={floating ? "sr-only" : "text-xs text-muted-foreground"}
      >{vb.t("Copiado")}</span
    >{/if}
  {#if issue}<div
      class={floating
        ? "mt-1 flex flex-wrap items-center justify-end gap-1"
        : "contents"}
    >
      {#if issue}<span role="alert" class="text-xs text-destructive"
          >{vb.t(
            issue === "empty"
              ? "Essa mensagem não tem texto pra copiar."
              : "O navegador pediu um toque pra copiar.",
          )}</span
        >{#if issue === "clipboard"}<Button
            variant="outline"
            size="sm"
            onclick={() => {
              void copy(retryLink);
            }}>{vb.t("Copiar")}</Button
          >{/if}{/if}
    </div>{/if}
</div>
{#snippet sheetRow(
  icon: IconName,
  label: string,
  act: () => void,
  data: Record<string, string | number>,
)}<Button
    variant="ghost"
    class="h-12 w-full justify-start gap-3 rounded-lg px-3 text-base font-normal"
    {...data}
    onclick={() => fromSheet(act)}
    ><Icon {icon} size={20} class="text-muted-foreground" />{label}</Button
  >{/snippet}
{#if floating}<Drawer bind:open={sheet}>
    <DrawerContent
      side="bottom"
      closeLabel={vb.t("Fechar")}
      bind:ref={sheetBox}
      tabindex={-1}
      onOpenAutoFocus={(event) => {
        // Focus the sheet, not the first reaction: no ring and no tooltip on open; Tab still walks the rows.
        event.preventDefault();
        sheetBox?.focus();
      }}
      data-message-sheet={message.id}
      class="gap-1 overflow-y-auto px-3 font-sans text-sm"
    >
      <SheetTitle class="sr-only">{vb.t("Ações desta mensagem")}</SheetTitle>
      <div
        aria-hidden="true"
        class="mx-auto mb-2 h-1 w-10 shrink-0 rounded-full bg-border"
      ></div>
      {#if canReact}<div
          data-sheet-reactions
          class="mb-2 flex items-center justify-between gap-1"
        >
          {#each QUICK_REACTIONS.slice(0, 6) as emoji (emoji)}<IconButton
              label={vb.t("Reagir com {emoji}", { emoji })}
              data-quick-react={emoji}
              aria-pressed={mine(emoji)}
              class={cn(
                "size-11 rounded-full bg-muted text-xl leading-none",
                mine(emoji) && "bg-accent ring-2 ring-ring",
              )}
              onclick={() => fromSheet(() => react(emoji))}>{emoji}</IconButton
            >{/each}<IconButton
            label={vb.t("Mais reações")}
            data-more-reactions={message.id}
            class="size-11 rounded-full bg-muted text-muted-foreground"
            onclick={() => fromSheet(() => (picking = true))}
            ><Icon icon="face-smile" size={20} /></IconButton
          >
        </div>{/if}
      {@render sheetRow(
        "reverse-left",
        vb.t("Responder"),
        () => actions.reply(message.id),
        { "data-sheet-reply": message.id },
      )}
      {#if onthread}{@render sheetRow(
          "git-branch-01",
          threadOpen ? vb.t("Abrir thread") : vb.t("Criar thread"),
          () => onthread?.(),
          { "data-sheet-thread": message.id },
        )}{/if}
      {#if onforward}{@render sheetRow(
          "share-06",
          vb.t("Encaminhar"),
          () => onforward?.(),
          { "data-sheet-forward": message.id },
        )}{/if}
      {@render sheetRow("copy-01", vb.t("Copiar texto"), () => void copy(), {
        "data-sheet-copy": message.id,
      })}
      {#if showLink}{@render sheetRow(
          "link-01",
          vb.t("Copiar link"),
          () => void copy(true),
          { "data-sheet-link": message.id },
        )}{/if}
      {#if canEdit}{@render sheetRow(
          "pencil-01",
          vb.t("Editar mensagem"),
          edit,
          { "data-sheet-edit": message.id },
        )}{/if}
      {#if history !== undefined}{@render sheetRow(
          "clock",
          vb.t("Ver histórico da mensagem"),
          openHistory,
          { "data-sheet-history": message.id },
        )}{/if}
      {#if canDelete}<Button
          variant="ghost"
          data-sheet-delete={message.id}
          class="h-12 w-full justify-start gap-3 rounded-lg px-3 text-base font-normal text-destructive hover:text-destructive"
          onclick={() =>
            fromSheet(() => {
              error = "";
              deleting = true;
            })}
          ><Icon icon="trash-01" size={20} />{vb.t("Apagar mensagem")}</Button
        >{/if}
    </DrawerContent>
  </Drawer>{/if}
{#if canDelete}<ConfirmDialog
    bind:open={deleting}
    title={vb.t("Apagar mensagem?")}
    description={vb.t(
      'Ela some para todo mundo e fica "Mensagem apagada" no lugar. Só o dono da sala ainda vê o que ela dizia.',
    )}
    confirmLabel={vb.t("Apagar")}
    cancelLabel={vb.t("Cancelar")}
    {busy}
    {error}
    onconfirm={() => void remove()}
  />{/if}
{#if history !== undefined}<Dialog bind:open={showingHistory}>
    <DialogContent
      class="font-sans text-sm text-foreground"
      closeLabel={vb.t("Fechar")}
      preventScroll={false}
      preventBodyPointerEvents={false}
      preventOverflowTextSelection={false}
    >
      <DialogHeader>
        <DialogTitle class="pr-8 font-sans"
          >{vb.t("Histórico da mensagem")}</DialogTitle
        >
      </DialogHeader>
      {#if history === null}<p role="status" class="m-0 text-muted-foreground">
          {vb.t("Carregando…")}
        </p>{:else}<ol class="m-0 flex list-none flex-col gap-3 p-0">
          {#each history as version (version.ts)}<li
              class="flex flex-col gap-1"
            >
              <span class="text-xs text-muted-foreground"
                >{version.kind === "delete"
                  ? vb.t("Apagada por {who}", {
                      who: vb.name(version.by.replace(/#agent$/, "")),
                    })
                  : vb.t("Antes da edição de {who}", {
                      who: vb.name(version.by.replace(/#agent$/, "")),
                    })} · {vb.ago(version.ts)}</span
              >
              <p class="m-0 break-words whitespace-pre-wrap">
                {version.text || "—"}
              </p>
              {#if version.files.length}<p
                  class="m-0 text-xs text-muted-foreground"
                >
                  {version.files.join(", ")}
                </p>{/if}
            </li>{/each}
        </ol>{/if}
    </DialogContent>
  </Dialog>{/if}
