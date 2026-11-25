<script lang="ts">
  import { onDestroy } from "svelte";
  import Embed from "./Embed.svelte";
  import type { Attachment } from "../../../shared/room";
  import type { ChatActions, ChatBridge } from "../../app/chatTypes";
  import { kb } from "../../app/panels";
  import Icon from "../../lib/studio/Icon.svelte";
  import { appFocusRequest } from "../room-layout/focus";
  import IconButton from "../../lib/studio/IconButton.svelte";
  import AttachmentCard, { cardIconClass } from "./AttachmentCard.svelte";
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
  const extension = (file: Attachment) =>
    (file.name.split(".").pop() ?? "").toUpperCase();
  const fileMeta = (file: Attachment) =>
    `${extension(file)} · ${kb(file.size)}`;
  /** Text you read (Markdown, plain text) gets the page icon; anything else the plain file. */
  const fileIcon = (file: Attachment) =>
    file.type === "text/markdown" ||
    file.type === "text/plain" ||
    /\.(md|markdown|txt)$/i.test(file.name)
      ? ("file-06" as const)
      : ("file-02" as const);
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

<!-- Expand is always the rightmost action, on files and on apps. -->
{#snippet fileActions(file: Attachment)}<IconButton
    label={vb.t("Baixar")}
    data-file-download
    href={url(file)}
    download={file.name}
    size="icon"
    class={cardIconClass}><Icon icon="download-01" size={18} /></IconButton
  ><IconButton
    label={vb.t("Abrir em tela cheia")}
    data-file-expand
    href={url(file)}
    size="icon"
    class={cardIconClass}
    onclick={(event) => open(event, file)}
    ><Icon icon="expand-01" size={18} /></IconButton
  >{/snippet}

{#if files.length}<div
    data-message-attachments
    class="mt-2 flex flex-wrap gap-2"
  >
    {#each files as file (file.id)}
      {#if !file.embed && file.type === "text/html" && /^apps\/[\w.-]+\.html$/.test(file.name)}{@const tool =
          file.name.slice(
            5,
            -5,
          )}<!-- A room app: the shared card; the body opens it beside the chat, the icons open it beside or expand it. -->
        <AttachmentCard
          data-room-app-card={tool}
          icon="grid-01"
          name={tool}
          meta={vb.t("App · {who}", { who: vb.name(file.author) })}
          disabled={!actions.openApp}
          openData={{ "data-room-app-open": true }}
          open={(event) => {
            if (!active || !event.currentTarget.isConnected) return;
            appFocusRequest.set(null);
            actions.openApp?.({ connection: "room", tool });
          }}
        >
          {#snippet trailing()}<IconButton
              label={vb.t("Abrir ao lado")}
              data-room-app-beside
              size="icon"
              disabled={!actions.openApp}
              class={cardIconClass}
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
              class={cardIconClass}
              onclick={(event) => {
                if (!active || !event.currentTarget.isConnected) return;
                appFocusRequest.set(tool);
                actions.openApp?.({ connection: "room", tool });
              }}><Icon icon="expand-01" size={18} /></IconButton
            >{/snippet}
        </AttachmentCard>
      {:else if file.embed}<Embed
          url={url(file)}
          {file}
          {messageThread}
          {actions}
          {vb}
        />
      {:else if beside(file) && actions.openSideFile}<!-- The same card: the body opens the file beside the chat; full screen and download are icons, so it holds at any width. -->
        <AttachmentCard
          data-html-file-card
          icon={fileIcon(file)}
          name={file.name}
          meta={actions.sideFileName === file.name
            ? vb.t("aberto ao lado")
            : fileMeta(file)}
          openData={{ "data-file-open-beside": true }}
          open={(event) => {
            if (active && event.currentTarget.isConnected)
              actions.openSideFile?.(file);
          }}
        >
          {#snippet trailing()}{@render fileActions(file)}{/snippet}
        </AttachmentCard>
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
      {:else}<!-- Any other file: the same card; the body opens it (the viewer, or the browser for what it can't show). -->
        <AttachmentCard
          data-file-card
          icon={fileIcon(file)}
          name={file.name}
          meta={fileMeta(file)}
          openData={{ "data-file-open": true }}
          open={(event) => {
            if (active && event.currentTarget.isConnected)
              actions.openFile(file);
          }}
        >
          {#snippet trailing()}{@render fileActions(file)}{/snippet}
        </AttachmentCard>{/if}
    {/each}
  </div>{/if}
