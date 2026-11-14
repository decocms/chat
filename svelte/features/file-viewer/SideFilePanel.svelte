<script lang="ts">
  import { untrack } from "svelte";
  import type { SideFileSession } from "./side";
  import type { RichActions } from "../rich-text/types";
  import FileViewer from "./FileViewer.svelte";
  import Button from "../../lib/ui/Button.svelte";
  import Snapshot from "../../lib/ui/Snapshot.svelte";
  let {
    owner,
    lang,
    actions,
    current,
    fullscreen,
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
</script>

{#if $view}
  <section
    data-side-file
    data-file-id={$view.id}
    class="tw:flex tw:h-full tw:min-h-0 tw:flex-col tw:gap-3 tw:p-3"
  >
    {#key $view}<Snapshot value={$view}
        >{#snippet children(target)}<header
            class="tw:flex tw:items-center tw:gap-2"
          >
            <b class="tw:min-w-0 tw:flex-1 tw:truncate">{target.name}</b>
            <Button
              variant="ghost"
              onclick={(event) => {
                if (live(event) && owner.target() === target)
                  fullscreen(target.id);
              }}
              >{lang === "en"
                ? "Open fullscreen"
                : "Abrir em tela cheia"}</Button
            >
            <Button
              variant="ghost"
              onclick={(event) => {
                if (live(event) && owner.target() === target) close();
              }}>{lang === "en" ? "Close" : "Fechar"}</Button
            >
          </header>{/snippet}</Snapshot
      >{/key}
    <div class="tw:min-h-0 tw:flex-1 tw:overflow-auto">
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
