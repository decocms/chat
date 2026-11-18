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
      ? "tw:animate-room-document-width-rail"
      : "tw:animate-room-document-width",
  );
  // The phone room's bottom bar: a sixth grid row, absent on desktop.
  const tabs = $derived($view.mobile && !!props.tabbar);
  const docPresented = $derived(
    $view.presentedSheet === "doc" || $view.draggingSheet === "doc",
  );
  const sidePresented = $derived(
    $view.presentedSheet === "side" || $view.draggingSheet === "side",
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
        "tw:col-start-2 tw:row-start-3 tw:row-end-6 tw:z-20 tw:h-full tw:w-full tw:animate-room-sheet"
      : $view.mobile
        ? "tw:col-start-2 tw:row-start-3 tw:row-end-6 tw:z-20 tw:h-room-document-sheet tw:w-full tw:self-start tw:animate-room-sheet tw:rounded-b-surface tw:shadow-lg tw:has-[form:focus-within]:h-full tw:has-[[contenteditable=true]:focus]:h-full tw:has-[form:focus-within]:rounded-none"
        : [
            "tw:col-start-3 tw:row-start-2 tw:row-end-6 tw:mr-2 tw:mb-2 tw:rounded-br-surface tw:border-l tw:border-border",
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
  data-vb-native
  data-native-room-layout
  data-pane={$view.pane}
  data-sheet={$view.sheet ?? undefined}
  data-board-full={$view.boardFull}
  class={[
    "tw:relative tw:h-full tw:min-h-0 tw:w-full tw:min-w-0 tw:overflow-hidden tw:font-sans tw:text-sm tw:text-foreground",
    $view.mobile ? "tw:bg-background" : "tw:bg-sidebar",
  ]}
>
  <div
    bind:this={viewport}
    class={[
      "tw:relative tw:grid tw:w-full tw:min-w-0 tw:animate-room-viewport tw:grid-rows-[auto_auto_auto_minmax(0,1fr)_auto] tw:overflow-hidden tw:[container-type:size]",
      tabs && "tw:grid-rows-[auto_auto_auto_minmax(0,1fr)_auto_auto]!",
      $view.mobile
        ? "tw:grid-cols-[0_minmax(0,1fr)_0] tw:[&_input]:text-base tw:[&_textarea]:text-base tw:[&_select]:text-base"
        : "tw:grid-cols-[auto_minmax(0,1fr)_auto]",
      $view.resizing && "tw:cursor-col-resize tw:select-none",
    ]}
  >
    <aside
      bind:this={sidebar}
      inert={!sideLive}
      data-room-sidebar
      class={[
        "tw:flex tw:min-h-0 tw:min-w-0 tw:flex-col tw:overflow-x-clip tw:bg-sidebar tw:text-sidebar-foreground",
        $view.mobile
          ? [
              "tw:absolute tw:inset-x-0 tw:top-0 tw:z-50 tw:h-[88%] tw:w-full tw:animate-room-sheet tw:rounded-b-surface tw:pt-[env(safe-area-inset-top)] tw:shadow-lg",
              sidePresented ? "tw:visible" : "tw:invisible",
            ]
          : [
              "tw:relative tw:z-10 tw:col-start-1 tw:row-start-1 tw:row-end-6 tw:my-2 tw:ml-px tw:overflow-hidden tw:rounded-l-surface tw:border-r tw:border-border",
              $view.sidebarCollapsed
                ? "tw:w-room-sidebar-rail"
                : "tw:w-room-sidebar",
            ],
      ]}
    >
      <div
        class="tw:min-h-0 tw:flex-1 tw:overflow-x-hidden tw:overflow-y-auto tw:overscroll-contain"
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
          ? "tw:flex tw:shrink-0 tw:touch-none tw:items-center tw:justify-center tw:border-0 tw:bg-background tw:px-4 tw:pt-2 tw:pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          : "tw:hidden"}
        ><span class="tw:h-1 tw:w-10 tw:rounded-full tw:bg-border"
        ></span></button
      >
    </aside>
    {#if !$view.mobile}<div
        aria-hidden="true"
        data-room-surface="chat"
        class={[
          "tw:pointer-events-none tw:col-start-1 tw:row-start-1 tw:row-end-6 tw:my-2 tw:mr-2 tw:ml-px tw:rounded-surface tw:bg-background tw:shadow-edge",
          split || props.overlayOpen ? "tw:col-end-4" : "tw:col-end-3",
        ]}
      ></div>{/if}
    <div
      bind:this={header}
      inert={$view.mobile && (props.overlayOpen || $view.sheet === "side")}
      data-room-header
      class={[
        "tw:relative tw:z-30 tw:col-start-2 tw:row-start-1 tw:min-w-0",
        $view.mobile
          ? "tw:max-h-[20cqh] tw:overflow-y-auto tw:overscroll-contain tw:border-b tw:border-border tw:bg-background tw:px-4 tw:pt-[max(0.75rem,env(safe-area-inset-top))] tw:pb-3"
          : [
              "tw:mt-2 tw:mr-2 tw:flex tw:h-[52px] tw:items-center tw:rounded-tr-surface tw:border-b tw:border-border tw:pr-3 tw:pl-5",
              (split || props.overlayOpen) && "tw:col-end-4",
            ],
        // Desktop keeps the top bar over the inbox (it fills the middle, like the board).
        $view.mobile && props.overlayOpen && "tw:hidden",
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
      $view.sheet === "doc"
        ? "tw:relative tw:z-30 tw:col-start-2 tw:row-start-2 tw:min-w-0 tw:touch-none tw:border-b tw:border-border tw:bg-background"
        : "tw:hidden"}
    >
      {@render props.peek()}
    </div>
    <div
      bind:this={attention}
      inert={props.overlayOpen || ($view.mobile && !!$view.sheet)}
      data-room-attention
      class={[
        "tw:col-start-2 tw:row-start-3 tw:min-w-0",
        $view.mobile
          ? "tw:max-h-[30cqh] tw:overflow-y-auto tw:overscroll-contain"
          : // With the pane open its border is the edge: the banner runs up to it.
            split
            ? "tw:px-2"
            : "tw:mr-2 tw:px-2",
        props.overlayOpen && "tw:hidden",
      ]}
    >
      {@render props.attention?.()}
    </div>
    <div
      bind:this={chat}
      inert={props.overlayOpen || ($view.mobile && !!$view.sheet)}
      data-room-chat
      class={props.overlayOpen || $view.boardFull
        ? "tw:hidden"
        : [
            "tw:col-start-2 tw:row-start-4 tw:min-h-0 tw:min-w-0 tw:overflow-y-auto tw:overscroll-contain tw:px-4",
            // Its own layer in a DM switch, so the conversation lifts in (browser.viewTransition).
            "tw:vt-dm:[view-transition-name:dm-chat]",
            // Full width as in Discord and Slack, with 24px gutters (16px on mobile) lined up with the composer and the cards above.
            !$view.mobile && "tw:mr-2 tw:px-6",
          ]}
    >
      {@render props.chat()}
    </div>
    <div
      bind:this={composer}
      inert={props.overlayOpen || ($view.mobile && !!$view.sheet)}
      data-room-composer
      class={props.overlayOpen || $view.boardFull
        ? "tw:hidden"
        : [
            "tw:col-start-2 tw:row-start-5 tw:min-w-0",
            tabs
              ? "" // The bar under it carries the home-bar inset.
              : $view.mobile
                ? "tw:pb-[env(safe-area-inset-bottom)]"
                : // No overflow-hidden: it clipped the @ mention list, which opens above the composer. The composer itself takes the rounded corners.
                  "tw:mr-2 tw:mb-2 tw:rounded-br-surface tw:[&>[data-native-composer]]:rounded-br-surface tw:px-2",
          ]}
    >
      {@render props.composer()}
    </div>
    <div
      bind:this={documentToolbar}
      inert={props.overlayOpen}
      data-room-document-toolbar-cell
      class="tw:hidden"
    >
      {@render props.documentToolbar()}
    </div>
    <section
      bind:this={documentCell}
      inert={props.overlayOpen || !docLive}
      data-room-document
      class={[
        "tw:relative tw:min-h-0 tw:min-w-0 tw:flex-col tw:overflow-hidden",
        $view.mobile && "tw:bg-background",
        rightVisible && $view.pane !== "board" ? "tw:flex" : "tw:hidden",
        paneClass,
        props.overlayOpen || ($view.mobile && !docPresented)
          ? "tw:invisible"
          : "tw:visible",
      ]}
    >
      <div
        class="tw:flex tw:min-h-0 tw:flex-1 tw:flex-col tw:overflow-auto tw:overscroll-contain"
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
        class={$view.mobile && !tabs
          ? "tw:flex tw:h-6 tw:shrink-0 tw:touch-none tw:items-center tw:justify-center tw:border-0 tw:bg-background"
          : "tw:hidden"}
        ><span class="tw:h-1 tw:w-10 tw:rounded-full tw:bg-border"
        ></span></button
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
        "tw:relative tw:min-h-0 tw:min-w-0 tw:flex-col tw:overflow-hidden",
        $view.mobile && "tw:bg-background",
        $view.boardFull
          ? [
              "tw:col-start-2 tw:row-start-4 tw:row-end-6 tw:flex tw:h-full",
              $view.mobile
                ? "tw:w-full"
                : "tw:mr-2 tw:mb-2 tw:h-auto tw:rounded-br-surface",
            ]
          : $view.pane === "board" && rightVisible
            ? ["tw:flex", paneClass]
            : "tw:hidden",
        props.overlayOpen || ($view.mobile && !$view.boardFull && !docPresented)
          ? "tw:invisible"
          : "tw:visible",
      ]}
    >
      <div
        class="tw:flex tw:min-h-0 tw:flex-1 tw:flex-col tw:overflow-auto tw:overscroll-contain tw:p-4"
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
        class={$view.mobile && !$view.boardFull
          ? "tw:flex tw:h-6 tw:shrink-0 tw:touch-none tw:items-center tw:justify-center tw:border-0 tw:bg-background"
          : "tw:hidden"}
        ><span class="tw:h-1 tw:w-10 tw:rounded-full tw:bg-border"
        ></span></button
      >
    </div>
    {#if tabs}<div
        data-room-tabbar
        inert={$view.sheet === "side"}
        class="tw:z-30 tw:col-start-2 tw:row-start-6 tw:min-w-0 tw:[[data-native-room-layout]:has([data-room-composer]:focus-within)_&]:hidden"
      >
        {@render props.tabbar?.()}
      </div>{/if}
    {#if props.overlayOpen}<div
        data-room-inbox-surface
        inert={$view.mobile && $view.sheet === "side"}
        class={[
          "tw:z-30 tw:col-start-2 tw:col-end-4 tw:row-end-6 tw:min-h-0 tw:min-w-0 tw:overflow-hidden tw:bg-background",
          // Phones: over the whole room. Desktop: under the top bar, in the frame.
          $view.mobile
            ? "tw:row-start-1"
            : "tw:row-start-2 tw:mr-2 tw:mb-2 tw:rounded-br-surface",
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
        ? "tw:z-30 tw:col-start-3 tw:row-start-2 tw:row-end-6 tw:mb-2 tw:-ml-1 tw:h-auto tw:w-2 tw:cursor-col-resize tw:touch-none tw:appearance-none tw:rounded-full tw:border-0 tw:bg-transparent tw:bg-clip-content tw:px-[3px] tw:py-0 tw:outline-none tw:transition-colors tw:duration-150 tw:hover:bg-ring/50 tw:focus-visible:bg-ring tw:[&::-moz-range-thumb]:size-0 tw:[&::-moz-range-thumb]:border-0 tw:[&::-webkit-slider-thumb]:size-0 tw:[&::-webkit-slider-thumb]:appearance-none"
        : "tw:hidden"}
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
        ? "tw:hidden"
        : [
            "tw:col-start-2 tw:row-start-3 tw:animate-room-scrim tw:border-0 tw:bg-scrim tw:p-0",
            // The thread sheet dims the bottom bar too.
            tabs ? "tw:row-end-7" : "tw:row-end-6",
            $view.presentedSheet === "side"
              ? "tw:absolute tw:inset-0 tw:z-40"
              : "tw:z-10",
            $view.presentedSheet || $view.draggingSheet
              ? "tw:visible"
              : "tw:invisible",
            $view.sheet ? "tw:pointer-events-auto" : "tw:pointer-events-none",
          ]}
    ></button>
  </div>
  {#if $view.closingUnconfirmed}<div
      role="status"
      class="tw:absolute tw:inset-x-4 tw:bottom-4 tw:z-50 tw:rounded-control tw:border tw:border-border tw:bg-popover tw:p-3 tw:text-popover-foreground"
    >
      <p>{props.labels.historyUnconfirmed}</p>
      <Button variant="outline" onclick={() => owner.retryHistory()}
        >{props.labels.historyRetry}</Button
      >
    </div>{/if}
  {#if $view.animationUnavailable}<p
      role="alert"
      class="tw:absolute tw:inset-x-4 tw:bottom-4 tw:z-50 tw:rounded-control tw:bg-destructive tw:p-3 tw:text-destructive-foreground"
    >
      {props.labels.animationUnavailable}
    </p>{/if}
</div>
