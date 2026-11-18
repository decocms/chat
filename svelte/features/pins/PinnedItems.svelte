<script lang="ts">
  import { onDestroy, tick } from "svelte";
  import { ContextMenu } from "bits-ui";
  import type { Attachment, Room } from "../../../shared/room";
  import type { SendRoomCommand } from "../../../shared/commands";
  import type { RequestRoomCommand } from "../../roomConnection";
  import { copyChatText } from "../chat/clipboard";
  import ErrorState from "../../lib/components/ErrorState.svelte";
  import { studioType } from "../../lib/components/type";
  import Button from "../../lib/studio/Button.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import IconButton from "../../lib/studio/IconButton.svelte";
  import Input from "../../lib/studio/Input.svelte";
  import Label from "../../lib/studio/Label.svelte";
  import {
    AlertTriangle,
    ChevronRight,
    File02,
    GitBranch01,
    Globe02,
    LinkExternal01,
    Pin02,
    Plus,
  } from "../../lib/studio/icons";
  import { cn } from "../../lib/studio/utils";
  import SectionHeader from "../room-sidebar/SectionHeader.svelte";
  import { readable, type Readable } from "svelte/store";
  import {
    pinAppInitials,
    pinAppTint,
    resolvePin,
    samePinApp,
    type PinAppTarget,
  } from "./model";
  import {
    closePinDraft,
    openPinDraft,
    removePinnedItem,
    requestPinnedFiles,
    submitPinDraft,
    updatePinDraft,
    type PinDraft,
    type PinIssue,
    type PinsSession,
  } from "./session";

  let {
    room,
    session,
    send,
    request,
    onopenfile,
    onopenapp,
    activeApp,
    t,
  }: {
    room: Room;
    session: PinsSession;
    send: SendRoomCommand;
    request: RequestRoomCommand;
    onopenfile: (file: Attachment) => void;
    onopenapp: (app: PinAppTarget) => void;
    /** The app open in the right pane, if any; its pinned row is shown selected. */
    activeApp?: Readable<{ connection: string; tool: string } | null>;
    t: (text: string, vars?: Record<string, string | number>) => string;
  } = $props();
  let disposed = false;
  onDestroy(() => {
    disposed = true;
  });
  function interactive() {
    return !disposed && session.active && session.roomId === room.id;
  }
  function updateDraft(patch: Partial<PinDraft>) {
    if (interactive()) updatePinDraft(session, patch);
  }
  function escape(event: KeyboardEvent) {
    if (!interactive() || event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    void close();
  }
  function retryFiles() {
    if (interactive()) requestPinnedFiles(session, room, send, true);
  }
  // Unpinning removes the row the menu returns focus to; once it is gone, focus moves to a neighbour.
  let refocus: { id: string; index: number } | null = null;
  function remove(id: string) {
    if (!interactive()) return;
    refocus = { id, index: rows.findIndex((row) => row.pin.id === id) };
    void removePinnedItem(session, room.id, id, request);
  }
  let sectionElement: HTMLElement | null = $state(null);
  $effect(() => {
    const ids = rows.map((row) => row.pin.id);
    if (!refocus || ids.includes(refocus.id)) return;
    const { index } = refocus;
    refocus = null;
    void tick().then(() => {
      const active = document.activeElement;
      // Only when focus was lost with the row; never steal it from wherever the person moved on to.
      if (
        disposed ||
        (active && active !== document.body && active.isConnected)
      )
        return;
      const next = ids[Math.min(Math.max(index, 0), ids.length - 1)];
      const row = [
        ...(sectionElement?.querySelectorAll<HTMLElement>("[data-pin-id]") ??
          []),
      ].find((element) => element.dataset.pinId === next);
      (
        row?.querySelector<HTMLElement>("[data-context-menu-trigger]") ??
        addButton ??
        sectionElement
      )?.focus();
    });
  });
  function openInNewTab(href: string) {
    if (interactive()) window.open(href, "_blank", "noopener,noreferrer");
  }
  // What the last "Copiar link" did, shown under the list for a moment (a failure stays until the next copy).
  let copyResult: "copied" | "failed" | null = $state(null);
  let copyTimer: ReturnType<typeof setTimeout> | undefined;
  let copySequence = 0;
  onDestroy(() => clearTimeout(copyTimer));
  async function copyLink(href: string) {
    if (!interactive()) return;
    const token = ++copySequence;
    clearTimeout(copyTimer);
    copyResult = null;
    try {
      await copyChatText(href);
      if (disposed || token !== copySequence) return;
      copyResult = "copied";
      navigator.vibrate?.(15);
      copyTimer = setTimeout(() => {
        if (token === copySequence) copyResult = null;
      }, 2500);
    } catch {
      if (!disposed && token === copySequence) copyResult = "failed";
    }
  }

  // Row menu: right-click (bits-ui), a ~500ms touch long press, or Shift+F10 / the ContextMenu key.
  // Every route ends in one contextmenu event on the row, so bits-ui positions and opens it the same way.
  let menuPin: string | null = $state(null);
  let keyboardMenu = false;
  const LONG_PRESS_MS = 500;
  const LONG_PRESS_SLOP = 8;
  let press: {
    timer: ReturnType<typeof setTimeout>;
    x: number;
    y: number;
  } | null = null;
  // A long press that opened the menu must not also count as a tap on the row when the finger lifts.
  let swallowClick = false;
  function showMenu(element: HTMLElement, x: number, y: number) {
    element.dispatchEvent(
      new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
      }),
    );
  }
  function cancelPress() {
    if (press) clearTimeout(press.timer);
    press = null;
  }
  onDestroy(cancelPress);
  function rowTrigger(
    props: Record<string, unknown>,
    id: string,
    menuOnly = false,
  ) {
    // bits-ui's own touch handling waits 700ms and cancels on any jitter; this row uses its own.
    const {
      onpointerdown: _down,
      onpointermove: _move,
      onpointerup: _up,
      onpointercancel: _cancel,
      ...rest
    } = props;
    return {
      ...rest,
      tabindex: 0,
      "aria-keyshortcuts": "Shift+F10",
      "aria-describedby": hintId,
      // A row whose only action is its menu (a broken target) is a menu button: Enter and Space open it too.
      ...(menuOnly ? { role: "button", "aria-haspopup": "menu" as const } : {}),
      onpointerdown(event: PointerEvent) {
        swallowClick = false;
        cancelPress();
        if (event.pointerType === "mouse" || !interactive()) return;
        const element = event.currentTarget as HTMLElement;
        const { clientX: x, clientY: y } = event;
        press = {
          x,
          y,
          timer: setTimeout(() => {
            press = null;
            if (disposed || !element.isConnected || menuPin === id) return;
            swallowClick = true;
            showMenu(element, x, y);
          }, LONG_PRESS_MS),
        };
      },
      onpointermove(event: PointerEvent) {
        if (
          press &&
          Math.hypot(event.clientX - press.x, event.clientY - press.y) >
            LONG_PRESS_SLOP
        )
          cancelPress();
      },
      onpointerup: cancelPress,
      onpointercancel: cancelPress,
      onkeydown(event: KeyboardEvent) {
        if (
          !(event.key === "F10" && event.shiftKey) &&
          event.key !== "ContextMenu" &&
          !(menuOnly && (event.key === "Enter" || event.key === " "))
        )
          return;
        event.preventDefault();
        if (!interactive()) return;
        const element = event.currentTarget as HTMLElement;
        const rect = element.getBoundingClientRect();
        keyboardMenu = true;
        showMenu(element, rect.left + 12, rect.bottom);
      },
      oncontextmenu(event: MouseEvent) {
        // A row left over from a closed session (whose disabled flag may lag) opens nothing.
        if (!interactive()) {
          cancelPress();
          event.preventDefault();
          return;
        }
        // A platform long press (Android) also fires contextmenu; one menu, and no tap after it.
        if (press) swallowClick = true;
        cancelPress();
        // Right-clicking another row moves the menu there; no click to swallow.
        dismissedAt = -Infinity;
        if (event.isTrusted) keyboardMenu = false;
        (rest.oncontextmenu as ((event: MouseEvent) => void) | undefined)?.(
          event,
        );
      },
    };
  }
  // Pressing another row only dismisses an open menu (like a native one); the press is not also a click on it.
  let dismissedAt = -Infinity;
  function dismissedByRow(event: PointerEvent) {
    if (
      event.target instanceof Element &&
      event.target.closest("[data-native-pins] [data-pin-id]")
    )
      dismissedAt = performance.now();
  }
  function swallowLongPressClick(event: MouseEvent) {
    // Keyboard activation (Enter/Space) is never the end of a press.
    if (event.detail === 0) return;
    if (swallowClick) {
      // The finger lifting after a long press: keep the menu it just opened.
      swallowClick = false;
      event.preventDefault();
      return;
    }
    // A mouse press dismissed the menu just before this click; a tap dismisses here, on the click
    // (bits-ui would skip its own dismissal for a click whose default is prevented).
    if (menuPin === null && performance.now() - dismissedAt >= 1000) return;
    menuPin = null;
    dismissedAt = -Infinity;
    event.preventDefault();
  }
  const menuId = (id: string) => `pin-menu-${room.id}-${id}`;
  function focusFirstItem(event: Event, id: string) {
    // Opened from the keyboard: start on the first item, like a menu button.
    if (!keyboardMenu) return;
    keyboardMenu = false;
    const first = document
      .getElementById(menuId(id))
      ?.querySelector<HTMLElement>("[role=menuitem]:not([data-disabled])");
    if (!first) return;
    event.preventDefault();
    first.focus();
  }
  const menuItemClass =
    "tw:relative tw:flex tw:cursor-pointer tw:select-none tw:items-center tw:gap-2 tw:rounded-lg tw:px-2 tw:py-1.5 tw:text-sm tw:outline-hidden tw:data-highlighted:bg-accent tw:data-highlighted:text-accent-foreground tw:data-disabled:pointer-events-none tw:data-disabled:opacity-50";
  const pinState = $derived(session.state);
  const noApp = readable(null);
  const openApp = $derived(activeApp ?? noApp);
  // Row: [kind icon] label / detail [marker]. The marker says what a click does:
  // "external" leaves vibebook in a new tab, the chevron opens inside it.
  const rowClass =
    "tw:flex tw:h-9 tw:min-w-0 tw:flex-1 tw:items-center tw:gap-2 tw:rounded-lg tw:border-0 tw:bg-transparent tw:px-2 tw:font-sans tw:text-sm tw:text-inherit tw:no-underline tw:outline-none tw:focus-visible:outline-2 tw:focus-visible:outline-solid tw:focus-visible:outline-ring";
  const kindClass =
    "tw:inline-grid tw:size-5 tw:shrink-0 tw:place-items-center tw:overflow-hidden tw:rounded-md";
  const markerClass = "tw:size-3.5 tw:shrink-0 tw:text-muted-foreground";
  const rows = $derived(
    (room.pins ?? []).map((pin) => ({ pin, target: resolvePin(pin, room) })),
  );
  const unknownFiles = $derived(
    rows.some((row) => row.target.kind === "file-unloaded"),
  );
  let fileToOpen: string | null = $state(null);
  let requestedFrom = $state.raw<PinsSession | null>(null);
  const live = $derived(session.active && session.roomId === room.id);
  let urlInput: HTMLInputElement | null = $state(null);
  let addButton: HTMLButtonElement | null = $state(null);
  const fieldId = $derived(`pin-url-${room.id}`);
  const hintId = $derived(`pins-hint-${room.id}`);
  const issueTitle = (issue: PinIssue) =>
    t(
      {
        "invalid-link": "Use um link http ou https válido.",
        offline: "Sem conexão. Seu rascunho foi mantido.",
        "send-failed": "Não deu pra enviar agora. Tente de novo.",
        unconfirmed:
          "Ainda não recebi confirmação. Confira os fixados antes de tentar de novo.",
        "already-pinned": "Este link já está nos fixados.",
        rejected: "Não deu pra atualizar os fixados. Tente de novo.",
      }[issue.kind],
    );

  $effect(() => {
    if (disposed || !fileToOpen) return;
    if (
      requestedFrom !== session ||
      !session.active ||
      session.roomId !== room.id
    ) {
      fileToOpen = null;
      requestedFrom = null;
      return;
    }
    const pin = room.pins?.find(
      (pin) => pin.id === fileToOpen && pin.kind === "file",
    );
    if (!pin) {
      fileToOpen = null;
      requestedFrom = null;
      return;
    }
    const target = resolvePin(pin, room);
    if (target.kind === "file") {
      fileToOpen = null;
      requestedFrom = null;
      onopenfile(target.file);
    } else if (room.filesAll) {
      fileToOpen = null;
      requestedFrom = null;
    }
  });
  async function open() {
    if (!interactive()) return;
    const current = session;
    openPinDraft(current);
    await tick();
    if (
      !disposed &&
      session === current &&
      current.active &&
      current.roomId === room.id &&
      urlInput?.isConnected
    )
      urlInput.focus();
  }
  async function close() {
    if (!interactive()) return;
    const current = session;
    closePinDraft(current);
    await tick();
    if (
      !disposed &&
      session === current &&
      current.active &&
      current.roomId === room.id &&
      addButton?.isConnected
    )
      addButton.focus();
  }
  function submit(event: SubmitEvent) {
    event.preventDefault();
    if (interactive()) void submitPinDraft(session, room.id, request);
  }
  function activate(id: string) {
    if (!interactive()) return;
    // Resolve again at the action boundary; a removed pin/file is not kept alive by a stale row closure.
    const pin = room.pins?.find((pin) => pin.id === id);
    if (!pin) return;
    const target = resolvePin(pin, room);
    if (target.kind === "file") onopenfile(target.file);
    if (target.kind === "app") onopenapp(target.app);
    if (target.kind === "file-unloaded") {
      requestedFrom = session;
      fileToOpen = id;
      requestPinnedFiles(session, room, send, !$pinState.filesPending);
    }
  }
</script>

{#snippet text(label: string, detail: string)}<span
    class="tw:flex tw:min-w-0 tw:flex-1 tw:items-baseline tw:gap-1.5 tw:text-left"
    data-pin-text
    ><span class="tw:min-w-0 tw:shrink tw:truncate">{label}</span><span
      class="tw:min-w-0 tw:flex-1 tw:truncate tw:text-xs tw:font-normal tw:text-muted-foreground"
      >{detail}</span
    ></span
  >{/snippet}

<!-- In the sidebar it gives way to the epics, down to its title and ~2 rows (one row or none: its own height). -->
<section
  class={cn(
    "tw:max-h-[20%] tw:space-y-0.5 tw:overflow-x-hidden tw:overflow-y-auto tw:overscroll-contain tw:bg-sidebar tw:font-sans tw:text-sm tw:leading-5 tw:text-sidebar-foreground tw:outline-none",
    rows.length > 1 ? "tw:min-h-24 tw:shrink" : "tw:shrink-0",
  )}
  aria-labelledby={`pins-title-${room.id}`}
  bind:this={sectionElement}
  tabindex="-1"
  data-native-pins
  data-vb-native
>
  <SectionHeader id={`pins-title-${room.id}`} title={t("Fixados")}>
    {#snippet action()}{#if !$pinState.adding}<IconButton
          label={t("Fixar um link")}
          size="icon-xs"
          tooltipSide="bottom"
          bind:ref={addButton}
          disabled={!live}
          onclick={open}><Icon icon={Plus} /></IconButton
        >{/if}{/snippet}
  </SectionHeader>

  {#if $pinState.adding}
    <form
      class="tw:space-y-3 tw:rounded-lg tw:bg-card tw:p-3 tw:shadow-edge"
      onsubmit={submit}
      aria-label={t("Fixar um link")}
    >
      <div class="tw:space-y-1.5">
        <Label for={fieldId}>{t("Link pra fixar")}</Label>
        <Input
          id={fieldId}
          name="url"
          bind:ref={urlInput}
          value={$pinState.draft.url}
          onkeydown={escape}
          oninput={(event) => updateDraft({ url: event.currentTarget.value })}
          required
          maxlength={2000}
          autocomplete="url"
          placeholder={t("Cole um link (site, repo, painel…)")}
          disabled={!live}
          aria-invalid={$pinState.issue?.kind === "invalid-link" || undefined}
        />
      </div>
      <div class="tw:space-y-1.5">
        <Label for={`${fieldId}-title`}>{t("Nome (opcional)")}</Label>
        <Input
          id={`${fieldId}-title`}
          name="title"
          value={$pinState.draft.title}
          onkeydown={escape}
          oninput={(event) => updateDraft({ title: event.currentTarget.value })}
          maxlength={80}
          disabled={!live}
        />
      </div>
      <div class="tw:flex tw:flex-wrap tw:justify-end tw:gap-2">
        <Button
          variant="ghost"
          size="sm"
          disabled={!live}
          onclick={close}
          onkeydown={escape}>{t("Cancelar")}</Button
        >
        <Button
          type="submit"
          size="sm"
          disabled={!live || !!$pinState.pending}
          onkeydown={escape}>{t("Fixar")}</Button
        >
      </div>
    </form>
  {/if}

  {#if $pinState.pending}
    <p
      role="status"
      class="tw:m-0 tw:px-2 tw:font-sans tw:text-xs tw:leading-5 tw:text-muted-foreground"
    >
      {t("Aguardando confirmação…")}
    </p>
  {/if}
  {#if $pinState.issue?.kind === "already-pinned"}
    <p
      role="status"
      class="tw:m-0 tw:px-2 tw:font-sans tw:text-xs tw:leading-5 tw:text-muted-foreground"
    >
      {issueTitle($pinState.issue)}
    </p>
  {:else if $pinState.issue}<ErrorState
      compact
      title={issueTitle($pinState.issue)}
      description={$pinState.issue.detail}
    />{/if}
  {#if $pinState.fileIssue}<ErrorState
      compact
      title={issueTitle({ kind: $pinState.fileIssue })}
    />{/if}
  {#if unknownFiles && ($pinState.filesPending || $pinState.fileIssue)}
    <Button variant="ghost" size="sm" disabled={!live} onclick={retryFiles}
      >{t("Tentar carregar novamente")}</Button
    >
  {/if}

  {#if copyResult === "copied"}
    <p
      role="status"
      class="tw:m-0 tw:px-2 tw:font-sans tw:text-xs tw:leading-5 tw:text-muted-foreground"
      data-pin-copy="copied"
    >
      {t("Link copiado")}
    </p>
  {:else if copyResult === "failed"}
    <p
      role="alert"
      class="tw:m-0 tw:px-2 tw:font-sans tw:text-xs tw:leading-5 tw:text-destructive"
      data-pin-copy="failed"
    >
      {t("Não consegui copiar o link.")}
    </p>
  {/if}
  {#if rows.length}
    <span id={hintId} class="tw:sr-only">{t("Shift+F10 abre mais ações")}</span>
    <ul class="tw:m-0 tw:flex tw:list-none tw:flex-col tw:gap-0.5 tw:p-0">
      {#each rows as { pin, target } (pin.id)}
        {@const selected =
          target.kind === "app" && samePinApp(target.app, $openApp)}
        <li
          class={cn(
            "tw:relative tw:flex tw:min-w-0 tw:items-center tw:rounded-lg tw:bg-sidebar tw:transition-colors tw:duration-150 tw:pointer-coarse:select-none tw:[-webkit-touch-callout:none] tw:hover:bg-sidebar-accent tw:focus-within:bg-sidebar-accent",
            selected &&
              "tw:bg-sidebar-accent tw:font-medium tw:text-sidebar-accent-foreground",
            menuPin === pin.id && "tw:bg-sidebar-accent",
          )}
          data-pin-id={pin.id}
          data-pin-kind={target.kind === "file-unloaded" ? "file" : target.kind}
          data-pin-opens={target.kind === "link"
            ? "tab"
            : target.kind === "unavailable"
              ? undefined
              : "inline"}
          data-selected={selected || undefined}
          onclickcapture={swallowLongPressClick}
        >
          <ContextMenu.Root
            bind:open={
              () => menuPin === pin.id,
              (open) => {
                if (open) menuPin = pin.id;
                else if (menuPin === pin.id) menuPin = null;
              }
            }
          >
            <ContextMenu.Trigger disabled={!live}>
              {#snippet child({ props })}
                {@const trigger = rowTrigger(
                  props,
                  pin.id,
                  target.kind === "unavailable",
                )}
                {#if target.kind === "link"}
                  <a
                    {...trigger}
                    href={target.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onclick={(event) => {
                      if (!interactive()) event.preventDefault();
                    }}
                    class={rowClass}
                  >
                    <span
                      class={kindClass}
                      data-pin-icon={target.github ? "github" : "globe"}
                      ><Icon
                        icon={target.github ? GitBranch01 : Globe02}
                        size={16}
                        class="tw:text-muted-foreground"
                      /></span
                    >{@render text(target.label, target.detail)}<Icon
                      icon={LinkExternal01}
                      class={markerClass}
                    /><span class="tw:sr-only">{t("abre em nova aba")}</span>
                  </a>
                {:else if target.kind === "file" || target.kind === "app" || target.kind === "file-unloaded"}
                  <Button
                    {...trigger}
                    variant="ghost"
                    class={cn(
                      rowClass,
                      "tw:justify-start tw:font-normal tw:hover:bg-transparent",
                    )}
                    disabled={!live}
                    aria-current={selected ? "true" : undefined}
                    onclick={(event) => {
                      if (!event.defaultPrevented) activate(pin.id);
                    }}
                  >
                    {#if target.kind === "app"}<span
                        class={cn(
                          kindClass,
                          "tw:text-[0.625rem] tw:font-semibold tw:leading-none",
                          pinAppTint(target.app),
                        )}
                        data-pin-icon="tile"
                        aria-hidden="true">{pinAppInitials(target.label)}</span
                      >{:else}<span class={kindClass} data-pin-icon="file"
                        ><Icon
                          icon={File02}
                          size={16}
                          class="tw:text-muted-foreground"
                        /></span
                      >{/if}{@render text(
                      target.label,
                      target.kind === "file-unloaded"
                        ? t(
                            $pinState.filesPending
                              ? "Carregando arquivo…"
                              : "Carregar arquivo",
                          )
                        : target.kind === "app"
                          ? t("App")
                          : target.detail,
                    )}<Icon icon={ChevronRight} class={markerClass} />
                  </Button>
                {:else}
                  <!-- Focusable so the keyboard can reach its menu (the only way to unpin it). -->
                  <div
                    {...trigger}
                    class={cn(rowClass, "tw:text-muted-foreground")}
                  >
                    <span class={kindClass}
                      ><Icon icon={AlertTriangle} size={16} /></span
                    >{@render text(target.label, t(target.reason))}
                  </div>
                {/if}
              {/snippet}
            </ContextMenu.Trigger>
            <ContextMenu.Portal>
              <ContextMenu.Content
                id={menuId(pin.id)}
                data-vb-native
                data-pin-menu={pin.id}
                aria-label={t("Ações de {name}", { name: target.label })}
                collisionPadding={8}
                onOpenAutoFocus={(event) => focusFirstItem(event, pin.id)}
                onInteractOutside={dismissedByRow}
                class={cn(
                  studioType,
                  "tw:z-50 tw:m-0 tw:box-border tw:min-w-44 tw:max-w-[calc(100vw-16px)] tw:rounded-lg tw:border tw:border-solid tw:border-border tw:bg-popover tw:p-1 tw:text-sm tw:text-popover-foreground tw:shadow-md tw:outline-none",
                )}
              >
                {#if target.kind === "link"}
                  {@const href = target.href}
                  <ContextMenu.Item
                    class={menuItemClass}
                    onSelect={() => openInNewTab(href)}
                    >{t("Abrir em nova aba")}</ContextMenu.Item
                  >
                  <ContextMenu.Item
                    class={menuItemClass}
                    onSelect={() => copyLink(href)}
                    >{t("Copiar link")}</ContextMenu.Item
                  >
                {:else if target.kind !== "unavailable"}
                  <ContextMenu.Item
                    class={menuItemClass}
                    onSelect={() => activate(pin.id)}
                    >{t("Abrir")}</ContextMenu.Item
                  >
                {/if}
                {#if target.kind !== "unavailable"}
                  <ContextMenu.Separator
                    class="tw:-mx-1 tw:my-1 tw:h-px tw:bg-border"
                  />
                {/if}
                <ContextMenu.Item
                  class={cn(
                    menuItemClass,
                    "tw:text-destructive tw:data-highlighted:bg-destructive/10 tw:data-highlighted:text-destructive",
                  )}
                  data-pin-unpin
                  disabled={!!$pinState.pending}
                  onSelect={() => remove(pin.id)}
                  >{t("Desafixar")}</ContextMenu.Item
                >
              </ContextMenu.Content>
            </ContextMenu.Portal>
          </ContextMenu.Root>
        </li>
      {/each}
    </ul>
  {:else if !$pinState.adding}
    <button
      type="button"
      data-pin-empty
      class="tw:flex tw:h-9 tw:w-full tw:cursor-pointer tw:items-center tw:gap-2 tw:rounded-lg tw:border tw:border-dashed tw:border-border tw:bg-transparent tw:px-2 tw:text-left tw:font-sans tw:text-sm tw:leading-5 tw:text-muted-foreground tw:transition-colors tw:duration-150 tw:hover:bg-sidebar-accent tw:hover:text-sidebar-foreground tw:focus-visible:outline-2 tw:focus-visible:outline-offset-2 tw:focus-visible:outline-ring tw:focus-visible:outline-solid tw:disabled:cursor-not-allowed tw:disabled:opacity-50"
      disabled={!live}
      onclick={open}
    >
      <span
        class="tw:flex tw:size-5 tw:shrink-0 tw:items-center tw:justify-center"
        ><Icon icon={Pin02} size={16} /></span
      >
      <span class="tw:min-w-0 tw:truncate">{t("Fixar site, repo ou app")}</span>
    </button>
  {/if}
</section>
