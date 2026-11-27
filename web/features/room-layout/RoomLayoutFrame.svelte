<script lang="ts">
  import { untrack } from "svelte";
  import { COMPOSER_SLOT } from "../composer/shape";
  import Button from "../../lib/studio/Button.svelte";
  import { paneFocus } from "./focus";
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
  const rightVisible = $derived($view.documentVisible);
  // Desktop: one frame (sidebar, chat and the open pane on one surface, hairlines
  // between them); with the pane open the top bar runs across chat and pane.
  const split = $derived(!$view.mobile && rightVisible && !props.overlayOpen);
  const people = $derived($view.pane === "people");
  // Expand: the pane fills the room and the composer floats over its foot.
  const focus = $derived($paneFocus && split);
  // The call's stage takes the left of the chat column; the chat cells keep a fixed column at its right.
  const staged = $derived(!$view.mobile && !!props.stage);
  const beside = $derived(
    staged &&
      (props.stageOnly
        ? "hidden"
        : "w-96 justify-self-end border-l border-border"),
  );
  // Another pane (or none) ends Expand: it belongs to the pane that asked for it.
  let focusedPane = $view.pane;
  $effect(() => {
    const pane = $view.pane;
    if (pane !== focusedPane) {
      focusedPane = pane;
      paneFocus.set(false);
    }
  });
  const paneClass = $derived(
    tabs
      ? // A tab, not a floor: it fills the space between the header and the bar.
        "col-start-2 row-start-3 row-end-6 z-20 h-full w-full animate-room-sheet"
      : $view.mobile
        ? // Phones: the pane takes the chat's place (under the top bar and the files strip), not a drawer.
          "col-start-2 row-start-3 row-end-6 z-20 h-full w-full animate-room-pane pb-[env(safe-area-inset-bottom)]"
        : focus
          ? // The width animation stays (a new one would start unseeked and come back narrow); the !important width wins over it.
            [
              "col-start-1 col-end-4 row-start-1 row-end-6 m-2 ml-px w-auto! rounded-surface",
              widthClass,
            ]
          : [
              "col-start-3 row-start-2 row-end-6 mr-2 mb-2 rounded-br-surface border-l border-border",
              widthClass,
              // A member list is a column of names: it never needs more than this, whatever width the pane was dragged to (Valls).
              people && "max-w-[330px]!",
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
        ? "grid-cols-[0_minmax(0,1fr)_0] [&_input]:text-[16px] [&_textarea]:text-[17px] [&_select]:text-[16px]"
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
              (focus || (staged && props.stageFull)) && "hidden!",
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
              (focus || (staged && props.stageFull)) && "hidden!",
            ],
      ]}
    >
      {@render props.header()}
    </div>
    <!-- No strip under the bar in the sheet (Gimenes #6117): the ⋮ switches panes. The cell stays for the layout, empty. -->
    <div
      bind:this={peek}
      use:handle={{ sheet: "doc", opening: true }}
      inert={props.overlayOpen || ($view.mobile && $view.sheet === "side")}
      data-room-peek
      class={"hidden"}
    >
      {@render props.peek()}
    </div>
    {#if staged}<div
        data-room-stage
        inert={props.overlayOpen}
        class={[
          "col-start-2 row-start-3 row-end-6 mb-2 min-h-0 min-w-0",
          props.stageOnly ? "mr-2" : "mr-96",
          (props.overlayOpen || focus) && "hidden",
        ]}
      >
        {@render props.stage?.()}
      </div>{/if}
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
        beside,
        (props.overlayOpen || focus) && "hidden",
      ]}
    >
      {@render props.attention?.()}
    </div>
    <div
      bind:this={chat}
      inert={props.overlayOpen || ($view.mobile && !!$view.sheet)}
      data-room-chat
      class={props.overlayOpen || focus
        ? "hidden"
        : [
            "col-start-2 row-start-4 min-h-0 min-w-0 overflow-y-auto overscroll-contain px-4",
            // Its own layer in a room switch, so the conversation lifts in (browser.viewTransition).
            "vt-room:[view-transition-name:room-chat]",
            // Full width as in Discord and Slack, with 24px gutters (16px on mobile) lined up with the composer and the cards above.
            !$view.mobile && (staged ? "mr-2 px-4" : "mr-2 px-6"),
            beside,
          ]}
    >
      {@render props.chat()}
    </div>
    <div
      bind:this={composer}
      inert={props.overlayOpen || ($view.mobile && !!$view.sheet)}
      data-room-composer
      class={props.overlayOpen
        ? "hidden"
        : focus
          ? // Floating over the pane's foot, as a card: you keep prompting while you look.
            "pointer-events-none absolute inset-x-0 bottom-4 z-40 flex flex-col items-center gap-2 px-6 [&>[data-composer]]:pointer-events-auto [&>[data-composer]]:w-full [&>[data-composer]]:max-w-[720px] [&>[data-composer]]:bg-transparent [&>[data-composer]]:p-0 [&_[data-composer-field]]:shadow-[0_4px_16px_-6px_rgb(0_0_0/0.14)] [&_[data-composer-field]:focus-within]:shadow-[inset_0_0_0_1px_var(--vb-input),0_4px_16px_-6px_rgb(0_0_0/0.14)]"
          : [
              "col-start-2 row-start-5 min-w-0",
              tabs
                ? "" // The bar under it carries the home-bar inset.
                : $view.mobile
                  ? "pb-[env(safe-area-inset-bottom)]"
                  : // No overflow-hidden: it clipped the @ mention list, which opens above the composer. The composer itself takes the rounded corners.
                    [
                      "mb-2 rounded-br-surface [&>[data-composer]]:rounded-br-surface",
                      COMPOSER_SLOT,
                      beside,
                    ],
            ]}
    >
      {#if focus}{@render props.focusPeek?.()}{/if}
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
        rightVisible ? "flex" : "hidden",
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
        disabled={!$view.active || $view.sheet !== "doc"}
        onclick={close}
        class="hidden"
        ><span class="h-1 w-10 rounded-full bg-border"></span></button
      >
    </section>
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
      class={!props.overlayOpen &&
      !people &&
      !focus &&
      !$view.mobile &&
      rightVisible
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
      use:handle={{ sheet: "side", opening: false }}
      data-room-scrim
      class={!$view.mobile
        ? "hidden"
        : [
            // Glass (Gimenes #3781): the room behind the title menu blurs as it dims; a tap on it closes the menu.
            "col-start-2 row-start-3 animate-room-scrim touch-none border-0 bg-scrim p-0 backdrop-blur-sm",
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
