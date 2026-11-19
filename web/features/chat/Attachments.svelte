<script lang="ts">
  import { onDestroy } from "svelte";
  import Embed from "./Embed.svelte";
  import type { Attachment } from "../../../shared/room";
  import type { ChatActions, ChatBridge } from "../../app/chatTypes";
  import { kb } from "../../app/panels";
  import Icon from "../../lib/studio/Icon.svelte";
  import Button from "../../lib/studio/Button.svelte";
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
      {#if !file.embed && file.type === "text/html" && /^apps\/[\w.-]+\.html$/.test(file.name)}<div
          data-room-app-row
          class="flex w-full items-center gap-2 rounded-control border border-border p-2"
        >
          <b class="min-w-0 flex-1 truncate">{file.name.slice(5, -5)}</b>
          <span class="text-xs text-muted-foreground"
            >{vb.t("app da sala")}</span
          >
          <Button
            variant="ghost"
            disabled={!actions.openApp}
            onclick={(event) => {
              if (active && event.currentTarget.isConnected)
                actions.openApp?.({
                  connection: "room",
                  tool: file.name.slice(5, -5),
                });
            }}>{vb.t("Abrir")}</Button
          >
        </div>
      {:else if file.embed}<Embed
          url={url(file)}
          {file}
          {messageThread}
          {actions}
          {vb}
        />
      {:else if file.type === "text/html" && actions.openSideFile}<div
          data-html-file-card
          class="flex w-full items-center gap-2 rounded-control border border-border p-3"
        >
          <b class="min-w-0 flex-1 truncate">{file.name}</b>
          {#if actions.sideFileName === file.name}<span
              class="text-xs text-primary">{vb.t("aberto ao lado")}</span
            >{:else}<Button
              variant="ghost"
              onclick={(event) => {
                if (active && event.currentTarget.isConnected)
                  actions.openSideFile?.(file);
              }}>{vb.t("Abrir")}</Button
            >{/if}
          <a
            href={url(file)}
            onclick={(event) => open(event, file)}
            class="text-xs text-foreground underline decoration-current/35 underline-offset-4 hover:decoration-current"
            >{vb.t("Abrir em tela cheia")}</a
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
