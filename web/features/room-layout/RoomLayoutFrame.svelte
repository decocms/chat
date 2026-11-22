<script lang="ts">
  import { untrack } from "svelte";
  import Button from "../../lib/studio/Button.svelte";
  import type { RoomLayoutProps, RoomLayoutCells, RoomSheet } from "./types";
  let props: RoomLayoutProps = $props();
  const owner = untrack(() => props.controller),
    view = owner.state;
  let root = $state<HTMLDivElement>(),
    viewport = $state<HTMLDivElement>(),
    sidebar = $state<HTMLElement>(),
    header = $state<HTMLElement>(),
    peek = $state<HTMLDivElement>(),
    attention = $state<HTMLDivElement>(),
    chat = $state<HTMLDivElement>(),
    composer = $state<HTMLDivElement>(),
    documentToolbar = $state<HTMLDivElement>(),
    documentCell = $state<HTMLElement>(),
    board = $state<HTMLDivElement>(),
    scrim = $state<HTMLButtonElement>();
  const widthClass = $derived(
    $view.sidebarCollapsed
      ? "animate-room-document-width-rail"
      : "animate-room-document-width",
  );
  // The phone room's bottom bar: a sixth grid row, absent on desktop.
  const tabs = $derived($view.mobile && !!props.tabbar);
  const docPresented = $derived(
    $view.presentedSheet === "doc" ||
      $view.draggingSheet === "doc" ||
      $view.leavingSheet === "doc",
  );
  const sidePresented = $derived(
    $view.presentedSheet === "side" ||
      $view.draggingSheet === "side" ||
      $view.leavingSheet === "side",
  );
  const docLive = $derived(
    !$view.mobile || $view.sheet === "doc" || $view.draggingSheet === "doc",
  );
  const sideLive = $derived(
    !$view.mobile || $view.sheet === "side" || $view.draggingSheet === "side",
  );
  const rightVisible = $derived(
    $view.documentVisible && !($view.boardFull && $view.pane === "board"),
  );
  // Desktop: one frame (sidebar, chat and the open pane on one surface, hairlines
  // between them); with the pane open the top bar runs across chat and pane.
  const split = $derived(!$view.mobile && rightVisible && !props.overlayOpen);
  const paneClass = $derived(
    tabs
      ? // A tab, not a floor: it fills the space between the header and the bar.
        "col-start-2 row-start-3 row-end-6 z-20 h-full w-full animate-room-sheet"
      : $view.mobile
        ? // Phones: the pane takes the chat's place (under the top bar and the files strip), not a drawer.
          "col-start-2 row-start-3 row-end-6 z-20 h-full w-full animate-room-pane pb-[env(safe-area-inset-bottom)]"
        : [
            "col-start-3 row-start-2 row-end-6 mr-2 mb-2 rounded-br-surface border-l border-border",
            widthClass,
          ],
  );
  function handle(
    node: HTMLElement,
    settings: { sheet: RoomSheet; opening: boolean },
  ) {
    return {
      destroy: owner.bindHandle(node, settings.sheet, settings.opening),
    };
  }
  function widthInput(node: HTMLInputElement) {
    return { destroy: owner.bindWidthInput(node) };
  }
  function close(event: MouseEvent) {
    if (
      event.currentTarget instanceof HTMLButtonElement &&
      event.currentTarget.isConnected &&
      !event.currentTarget.disabled
    )
      owner.closeSheet();
  }
  $effect(() => {
    if (
      !root ||
      !viewport ||
      !sidebar ||
      !header ||
      !peek ||
      !attention ||
      !chat ||
      !composer ||
      !documentToolbar ||
      !documentCell ||
      !board ||
      !scrim
    )
      return;
    const cells: RoomLayoutCells = {
      root,
      viewport,
      sidebar,
      header,
      peek,
      attention,
      chat,
      composer,
      documentToolbar,
      document: documentCell,
      board,
      scrim,
    };
    const stop = owner.mount(cells);
    const stopChat = untrack(() => props.onChatSurface?.(cells.chat)),
      stopCells = untrack(() => props.onCells?.(cells));
    return () => {
      stop();
      if (typeof stopChat === "function") stopChat();
      if (typeof stopCells === "function") stopCells();
    };
  });
</script>

<div
  bind:this={root}
  data-room-layout
  data-pane={$view.pane}
  data-sheet={$view.sheet ?? undefined}
  data-board-full={$view.boardFull}
  class={[
    "relative h-full min-h-0 w-full min-w-0 overflow-hidden font-sans text-sm text-foreground",
    $view.mobile ? "bg-background" : "bg-sidebar",
  ]}
>
  <div
    bind:this={viewport}
    class={[
      "relative grid w-full min-w-0 animate-room-viewport grid-rows-[auto_auto_auto_minmax(0,1fr)_auto] overflow-hidden [container-type:size]",
      tabs && "grid-rows-[auto_auto_auto_minmax(0,1fr)_auto_auto]!",
      $view.mobile
        ? "grid-cols-[0_minmax(0,1fr)_0] [&_input]:text-[16px] [&_textarea]:text-[16px] [&_select]:text-[16px]"
        : "grid-cols-[auto_minmax(0,1fr)_auto]",
      $view.resizing && "cursor-col-resize select-none",
    ]}
  >
    <aside
      bind:this={sidebar}
      inert={!sideLive}
      data-room-sidebar
      class={[
        "flex min-h-0 min-w-0 flex-col overflow-x-clip bg-sidebar text-sidebar-foreground",
        $view.mobile
          ? [
              "absolute inset-x-0 top-0 z-50 h-[88%] w-full animate-room-sheet rounded-b-surface pt-[env(safe-area-inset-top)] shadow-lg",
              sidePresented ? "visible" : "invisible",
            ]
          : [
              "relative z-10 col-start-1 row-start-1 row-end-6 my-2 ml-px overflow-hidden rounded-l-surface border-r border-border",
              $view.sidebarCollapsed ? "w-room-sidebar-rail" : "w-room-sidebar",
            ],
      ]}
    >
      <div
        class="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain"
      >
        {@render props.sidebar()}
      </div>
      <button
        type="button"
        use:handle={{ sheet: "side", opening: false }}
        aria-label={props.labels.closeSidebar}
        disabled={!$view.active || $view.sheet !== "side"}
        onclick={close}
        class={$view.mobile
          ? "flex shrink-0 touch-none items-center justify-center border-0 bg-background px-4 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          : "hidden"}
        ><span class="h-1 w-10 rounded-full bg-border"></span></button
      >
    </aside>
    {#if !$view.mobile}<div
        aria-hidden="true"
        data-room-surface="chat"
        class={[
          "pointer-events-none col-start-1 row-start-1 row-end-6 my-2 mr-2 ml-px rounded-surface bg-background shadow-edge",
          split || props.overlayOpen ? "col-end-4" : "col-end-3",
        ]}
      ></div>{/if}
    <div
      bind:this={header}
      inert={$view.mobile && $view.sheet === "side"}
      data-room-header
      class={[
        "relative z-30 col-start-2 row-start-1 min-w-0",
        $view.mobile
          ? "max-h-[20cqh] overflow-y-auto overscroll-contain border-b border-border bg-background px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3"
          : [
              "mt-2 mr-2 flex h-[52px] items-center rounded-tr-surface border-b border-border pr-3 pl-5",
              (split || props.overlayOpen) && "col-end-4",
            ],
      ]}
    >
      {@render props.header()}
    </div>
    <div
      bind:this={peek}
      use:handle={{ sheet: "doc", opening: true }}
      inert={props.overlayOpen || ($view.mobile && $view.sheet === "side")}
      data-room-peek
      class={!props.overlayOpen &&
      $view.mobile &&
      !$view.boardFull &&
      // The doc sheet's height is a share of the rows under this strip, so the
      // strip stays until the slide out ends: the sheet keeps one height.
      ($view.sheet === "doc" || docPresented)
        ? "relative z-30 col-start-2 row-start-2 min-w-0 touch-none border-b border-border bg-background"
        : "hidden"}
    >
      {@render props.peek()}
    </div>
    <div
      bind:this={attention}
      inert={props.overlayOpen || ($view.mobile && !!$view.sheet)}
      data-room-attention
      class={[
        "col-start-2 row-start-3 min-w-0",
        $view.mobile
          ? "max-h-[30cqh] overflow-y-auto overscroll-contain"
          : // With the pane open its border is the edge: the banner runs up to it.
            split
            ? "px-2"
            : "mr-2 px-2",
        props.overlayOpen && "hidden",
      ]}
    >
      {@render props.attention?.()}
    </div>
    <div
      bind:this={chat}
      inert={props.overlayOpen || ($view.mobile && !!$view.sheet)}
      data-room-chat
      class={props.overlayOpen || $view.boardFull
        ? "hidden"
        : [
            "col-start-2 row-start-4 min-h-0 min-w-0 overflow-y-auto overscroll-contain px-4",
            // Its own layer in a room switch, so the conversation lifts in (browser.viewTransition).
            "vt-room:[view-transition-name:room-chat]",
            // Full width as in Discord and Slack, with 24px gutters (16px on mobile) lined up with the composer and the cards above.
            !$view.mobile && "mr-2 px-6",
          ]}
    >
      {@render props.chat()}
    </div>
    <div
      bind:this={composer}
      inert={props.overlayOpen || ($view.mobile && !!$view.sheet)}
      data-room-composer
      class={props.overlayOpen || $view.boardFull
        ? "hidden"
        : [
            "col-start-2 row-start-5 min-w-0",
            tabs
              ? "" // The bar under it carries the home-bar inset.
              : $view.mobile
                ? "pb-[env(safe-area-inset-bottom)]"
                : // No overflow-hidden: it clipped the @ mention list, which opens above the composer. The composer itself takes the rounded corners.
                  "mr-2 mb-2 rounded-br-surface [&>[data-composer]]:rounded-br-surface px-2",
          ]}
    >
      {@render props.composer()}
    </div>
    <div
      bind:this={documentToolbar}
      inert={props.overlayOpen}
      data-room-document-toolbar-cell
      class="hidden"
    >
      {@render props.documentToolbar()}
    </div>
    <section
      bind:this={documentCell}
      inert={props.overlayOpen || !docLive}
      data-room-document
      class={[
        "relative min-h-0 min-w-0 flex-col overflow-hidden",
        $view.mobile && "bg-background",
        rightVisible && $view.pane !== "board" ? "flex" : "hidden",
        paneClass,
        props.overlayOpen || ($view.mobile && !docPresented)
          ? "invisible"
          : "visible",
      ]}
    >
      <div
        class="flex min-h-0 flex-1 flex-col overflow-auto overscroll-contain"
      >
        {@render props.document()}
      </div>
      <button
        type="button"
        use:handle={{ sheet: "doc", opening: false }}
        aria-label={props.labels.closeDocument}
        disabled={!$view.active ||
          $view.sheet !== "doc" ||
          $view.pane === "board"}
        onclick={close}
        class="hidden"
        ><span class="h-1 w-10 rounded-full bg-border"></span></button
      >
    </section>
    <div
      bind:this={board}
      inert={props.overlayOpen ||
        ($view.mobile &&
          ($view.sheet === "side" || (!$view.boardFull && !docLive)))}
      data-room-board
      data-placement={$view.boardFull ? "full" : "pane"}
      class={[
        "relative min-h-0 min-w-0 flex-col overflow-hidden",
        $view.mobile && "bg-background",
        $view.boardFull
          ? [
              "col-start-2 row-start-4 row-end-6 flex h-full",
              $view.mobile ? "w-full" : "mr-2 mb-2 h-auto rounded-br-surface",
            ]
          : $view.pane === "board" && rightVisible
            ? ["flex", paneClass]
            : "hidden",
        props.overlayOpen || ($view.mobile && !$view.boardFull && !docPresented)
          ? "invisible"
          : "visible",
      ]}
    >
      <div
        class="flex min-h-0 flex-1 flex-col overflow-auto overscroll-contain p-4"
      >
        {@render props.board()}
      </div>
      <button
        type="button"
        use:handle={{ sheet: "doc", opening: false }}
        aria-label={props.labels.closeDocument}
        disabled={!$view.active ||
          $view.sheet !== "doc" ||
          $view.pane !== "board"}
        onclick={close}
        class="hidden"
        ><span class="h-1 w-10 rounded-full bg-border"></span></button
      >
    </div>
    {#if tabs}<div
        data-room-tabbar
        inert={$view.sheet === "side"}
        class="z-30 col-start-2 row-start-6 min-w-0 [[data-room-layout]:has([data-room-composer]:focus-within)_&]:hidden"
      >
        {@render props.tabbar?.()}
      </div>{/if}
    {#if props.overlayOpen}<div
        data-room-inbox-surface
        inert={$view.mobile && $view.sheet === "side"}
        class={[
          "z-30 col-start-2 col-end-4 row-end-6 min-h-0 min-w-0 overflow-hidden bg-background",
          // Under the top bar, which keeps its Inbox button pressed (phones) or runs across (desktop).
          $view.mobile
            ? "row-start-2"
            : "row-start-2 mr-2 mb-2 rounded-br-surface",
        ]}
      >
        {@render props.overlay?.()}
      </div>{/if}
    <input
      use:widthInput
      type="range"
      min="260"
      max={$view.documentMaximum}
      step="1"
      value={$view.documentWidth}
      disabled={!$view.active || props.overlayOpen}
      aria-label={props.labels.documentWidth}
      data-room-width
      class={!props.overlayOpen && !$view.mobile && rightVisible
        ? "z-30 col-start-3 row-start-2 row-end-6 mb-2 -ml-1 h-auto w-2 cursor-col-resize touch-none appearance-none rounded-full border-0 bg-transparent bg-clip-content px-[3px] py-0 outline-none transition-colors duration-150 hover:bg-ring/50 focus-visible:bg-ring [&::-moz-range-thumb]:size-0 [&::-moz-range-thumb]:border-0 [&::-webkit-slider-thumb]:size-0 [&::-webkit-slider-thumb]:appearance-none"
        : "hidden"}
    />
    <button
      bind:this={scrim}
      type="button"
      tabindex="-1"
      aria-label={props.labels.closeSheet}
      disabled={!$view.active || !$view.sheet}
      onclick={close}
      data-room-scrim
      class={!$view.mobile
        ? "hidden"
        : [
            "col-start-2 row-start-3 animate-room-scrim border-0 bg-scrim p-0",
            // The thread sheet dims the bottom bar too.
            tabs ? "row-end-7" : "row-end-6",
            $view.presentedSheet === "side" ? "absolute inset-0 z-40" : "z-10",
            // The doc pane covers the chat; only the side sheet dims the room.
            sidePresented ? "visible" : "invisible",
            $view.sheet ? "pointer-events-auto" : "pointer-events-none",
          ]}
    ></button>
  </div>
  {#if $view.closingUnconfirmed}<div
      role="status"
      class="absolute inset-x-4 bottom-4 z-50 rounded-control border border-border bg-popover p-3 text-popover-foreground"
    >
      <p>{props.labels.historyUnconfirmed}</p>
      <Button variant="outline" onclick={() => owner.retryHistory()}
        >{props.labels.historyRetry}</Button
      >
    </div>{/if}
  {#if $view.animationUnavailable}<p
      role="alert"
      class="absolute inset-x-4 bottom-4 z-50 rounded-control bg-destructive p-3 text-destructive-foreground"
    >
      {props.labels.animationUnavailable}
    </p>{/if}
</div>
