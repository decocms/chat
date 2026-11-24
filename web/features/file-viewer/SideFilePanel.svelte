<script lang="ts">
  import { untrack } from "svelte";
  import type { SideFileSession } from "./side";
  import type { RichActions } from "../rich-text/types";
  import FileViewer from "./FileViewer.svelte";
  import VersionPicker from "./VersionPicker.svelte";
  import IconButton from "../../lib/studio/IconButton.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import Snapshot from "../../lib/components/Snapshot.svelte";
  import { paneFocus } from "../room-layout/focus";
  import { externalFileURL } from "./model";
  let {
    owner,
    lang,
    actions,
    current,
    close,
  }: {
    owner: SideFileSession;
    lang: "pt" | "en";
    actions: RichActions;
    current(): boolean;
    fullscreen(id: string): void;
    close(): void;
  } = $props();
  const view = untrack(() => owner.state);
  const live = (event: Event) =>
    current() &&
    event.currentTarget instanceof HTMLElement &&
    event.currentTarget.isConnected;
  const t = (pt: string, en: string) => (lang === "en" ? en : pt);
  // Expand ends with the file: Esc, closing it, or leaving the pane.
  $effect(() => () => paneFocus.set(false));
  const escape = (event: KeyboardEvent) => {
    if (event.key === "Escape" && $paneFocus && !event.defaultPrevented)
      paneFocus.set(false);
  };
</script>

<svelte:window onkeydown={escape} />

{#if $view}
  <section
    data-side-file
    data-file-id={$view.id}
    class="flex h-full min-h-0 flex-col"
  >
    {#key $view}<Snapshot value={$view}
        >{#snippet children(target)}<header
            data-file-bar
            class="flex h-12 shrink-0 items-center gap-0.5 border-b border-border pr-2 pl-4"
          >
            <h2
              class="m-0 min-w-16 flex-1 truncate font-sans text-sm font-semibold tracking-normal"
              title={target.name}
            >
              {target.name}
            </h2>
            <VersionPicker
              controller={owner.viewer}
              {lang}
              onselect={(id) => {
                if (current())
                  owner.target() && owner.select(owner.target()!, id);
              }}
            />
            <IconButton
              label={t("Abrir em outra aba", "Open in a new tab")}
              tooltipSide="bottom"
              size="icon"
              class="text-muted-foreground hover:text-foreground"
              href={externalFileURL(target, location.origin, false)}
              target="_blank"
              rel="noopener noreferrer"
              ><Icon icon="link-external-01" size={18} /></IconButton
            >
            <IconButton
              label={t("Baixar", "Download")}
              tooltipSide="bottom"
              size="icon"
              class="text-muted-foreground hover:text-foreground"
              data-file-download
              href={`/api/books/${encodeURIComponent(target.roomId)}/files/${encodeURIComponent(target.id)}`}
              download={target.name}
              ><Icon icon="download-01" size={18} /></IconButton
            >
            <IconButton
              label={$paneFocus
                ? t("Sair da tela cheia", "Exit full screen")
                : t("Expandir", "Expand")}
              tooltipSide="bottom"
              size="icon"
              class="text-muted-foreground hover:text-foreground"
              aria-pressed={$paneFocus}
              data-file-expand
              onclick={(event) => {
                if (live(event)) paneFocus.update((on) => !on);
              }}
              ><Icon
                icon={$paneFocus ? "minimize-01" : "expand-01"}
                size={18}
              /></IconButton
            >
            <span aria-hidden="true" class="mx-1 h-5 w-px bg-border"></span>
            <IconButton
              label={t("Fechar", "Close")}
              tooltipSide="bottom"
              size="icon"
              class="text-muted-foreground hover:text-foreground"
              onclick={(event) => {
                if (live(event) && owner.target() === target) {
                  paneFocus.set(false);
                  close();
                }
              }}><Icon icon="x" size={18} /></IconButton
            >
          </header>{/snippet}</Snapshot
      >{/key}
    <div class="flex min-h-0 flex-1 flex-col overflow-auto p-4">
      <FileViewer
        controller={owner.viewer}
        {lang}
        {actions}
        inline
        onselect={(id) => {
          if (current()) owner.target() && owner.select(owner.target()!, id);
        }}
        onclose={() => {
          if (current()) close();
        }}
      />
    </div>
  </section>
{/if}
