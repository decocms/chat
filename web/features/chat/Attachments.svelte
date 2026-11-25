<script lang="ts">
  import { onDestroy } from "svelte";
  import Embed from "./Embed.svelte";
  import type { Attachment } from "../../../shared/room";
  import type { ChatActions, ChatBridge } from "../../app/chatTypes";
  import { kb } from "../../app/panels";
  import Icon from "../../lib/studio/Icon.svelte";
  import { appFocusRequest } from "../room-layout/focus";
  import IconButton from "../../lib/studio/IconButton.svelte";
  let {
    roomId,
    files = [],
    messageThread,
    actions,
    vb,
  }: {
    roomId: string;
    messageThread: string;
    files?: Attachment[];
    actions: ChatActions;
    vb: ChatBridge;
  } = $props();
  let active = true;
  onDestroy(() => {
    active = false;
  });
  const url = (file: Attachment) =>
    `/api/books/${encodeURIComponent(roomId)}/files/${encodeURIComponent(file.id)}`;
  /** Read beside the chat (HTML, Markdown, text): open there by default, so you can keep chatting while you read. */
  const beside = (file: Attachment) =>
    file.type === "text/html" ||
    file.type === "text/markdown" ||
    file.type === "text/plain" ||
    /\.(md|markdown|txt)$/i.test(file.name);
  function open(event: MouseEvent, file: Attachment) {
    if (
      !active ||
      !(event.currentTarget instanceof HTMLElement) ||
      !event.currentTarget.isConnected
    ) {
      event.preventDefault();
      return;
    }
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    event.preventDefault();
    event.stopPropagation();
    actions.openFile(file);
  }
</script>

{#if files.length}<div
    data-message-attachments
    class="mt-2 flex flex-wrap gap-2"
  >
    {#each files as file (file.id)}
      {#if !file.embed && file.type === "text/html" && /^apps\/[\w.-]+\.html$/.test(file.name)}{@const tool =
          file.name.slice(
            5,
            -5,
          )}<!-- A room app: one flat gray card (tile, name, who made it); the body opens it beside the chat, two quiet icons open it beside or expand it. -->
        <div
          data-room-app-card={tool}
          class="flex w-full max-w-md min-w-0 items-center gap-1 rounded-2xl bg-muted p-1.5 pr-2.5"
        >
          <button
            type="button"
            data-room-app-open
            disabled={!actions.openApp}
            class="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-xl border-0 bg-transparent p-2 text-left text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:cursor-default"
            onclick={(event) => {
              if (!active || !event.currentTarget.isConnected) return;
              appFocusRequest.set(null);
              actions.openApp?.({ connection: "room", tool });
            }}
            ><span
              data-room-app-icon
              aria-hidden="true"
              class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-secondary-hover text-muted-foreground"
              ><Icon icon="grid-01" size={18} /></span
            ><span class="min-w-0 flex-1"
              ><span class="block truncate text-base text-foreground"
                >{tool}</span
              ><span
                data-room-app-meta
                class="block truncate text-sm text-muted-foreground"
                >{vb.t("App · {who}", { who: vb.name(file.author) })}</span
              ></span
            ></button
          ><IconButton
            label={vb.t("Abrir ao lado")}
            data-room-app-beside
            size="icon"
            disabled={!actions.openApp}
            class="text-muted-foreground hover:bg-secondary-hover hover:text-foreground"
            onclick={(event) => {
              if (!active || !event.currentTarget.isConnected) return;
              appFocusRequest.set(null);
              actions.openApp?.({ connection: "room", tool });
            }}><Icon icon="layout-right" size={18} /></IconButton
          ><IconButton
            label={vb.t("Expandir")}
            data-room-app-expand
            size="icon"
            disabled={!actions.openApp}
            class="text-muted-foreground hover:bg-secondary-hover hover:text-foreground"
            onclick={(event) => {
              if (!active || !event.currentTarget.isConnected) return;
              appFocusRequest.set(tool);
              actions.openApp?.({ connection: "room", tool });
            }}><Icon icon="expand-01" size={18} /></IconButton
          >
        </div>
      {:else if file.embed}<Embed
          url={url(file)}
          {file}
          {messageThread}
          {actions}
          {vb}
        />
      {:else if beside(file) && actions.openSideFile}<!-- One card that opens the file beside the chat; full screen and download are icons, so it holds at any width. -->
        <div
          data-html-file-card
          class="flex w-full max-w-md min-w-0 items-center gap-1 rounded-control border border-border p-1.5 pr-2"
        >
          <button
            type="button"
            data-file-open-beside
            class="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-[calc(var(--radius-control)-2px)] border-0 bg-transparent p-1.5 text-left text-foreground transition-colors duration-150 hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
            onclick={(event) => {
              if (active && event.currentTarget.isConnected)
                actions.openSideFile?.(file);
            }}
            ><span
              class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
              ><Icon icon="file-02" size={18} /></span
            ><span class="min-w-0 flex-1"
              ><span class="block truncate text-sm font-semibold"
                >{file.name}</span
              ><span class="block truncate text-xs text-muted-foreground"
                >{actions.sideFileName === file.name
                  ? vb.t("aberto ao lado")
                  : `${(file.name.split(".").pop() ?? "").toUpperCase()} · ${kb(file.size)}`}</span
              ></span
            ></button
          ><IconButton
            label={vb.t("Abrir em tela cheia")}
            href={url(file)}
            size="icon"
            class="text-muted-foreground hover:text-foreground"
            onclick={(event) => open(event, file)}
            ><Icon icon="expand-01" size={18} /></IconButton
          ><IconButton
            label={vb.t("Baixar")}
            data-file-download
            href={url(file)}
            download={file.name}
            size="icon"
            class="text-muted-foreground hover:text-foreground"
            ><Icon icon="download-01" size={18} /></IconButton
          >
        </div>
      {:else if file.type.startsWith("audio/")}<div
          class="max-w-full space-y-1"
        >
          <audio controls preload="metadata" src={url(file)} class="max-w-full"
          ></audio><a
            href={url(file)}
            target="_blank"
            rel="noopener"
            download={file.name}
            class="block break-words text-xs text-foreground underline decoration-current/35 underline-offset-4 hover:decoration-current"
            >{file.name} · {kb(file.size)}</a
          >
        </div>
      {:else if file.type.startsWith("image/")}<a
          data-message-image
          href={url(file)}
          target="_blank"
          rel="noopener"
          onclick={(event) => open(event, file)}
          class="block min-w-[min(220px,100%)] max-w-[min(320px,100%)] rounded-control focus-visible:outline-2 focus-visible:outline-ring"
          ><img
            src={url(file)}
            alt={file.name}
            loading="lazy"
            class="box-border block max-h-[260px] min-w-full max-w-full rounded-control border border-border object-cover object-top"
          /></a
        >
      {:else}<a
          href={url(file)}
          target="_blank"
          rel="noopener"
          onclick={(event) => open(event, file)}
          class="inline-flex max-w-full items-center gap-2 rounded-control border border-border bg-muted px-3 py-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-ring"
          ><Icon icon="file-02" size={16} /><span class="min-w-0 break-words"
            >{file.name}</span
          ><small class="shrink-0 text-muted-foreground">{kb(file.size)}</small
          ></a
        >{/if}
    {/each}
  </div>{/if}
