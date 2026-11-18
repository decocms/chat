<script lang="ts">
  import { untrack } from "svelte";
  import type { SideFileSession } from "./side";
  import type { RichActions } from "../rich-text/types";
  import FileViewer from "./FileViewer.svelte";
  import Button from "../../lib/studio/Button.svelte";
  import Snapshot from "../../lib/components/Snapshot.svelte";
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
    class="flex h-full min-h-0 flex-col gap-3 p-3"
  >
    {#key $view}<Snapshot value={$view}
        >{#snippet children(target)}<header class="flex items-center gap-2">
            <b class="min-w-0 flex-1 truncate">{target.name}</b>
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
    <div class="min-h-0 flex-1 overflow-auto">
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
