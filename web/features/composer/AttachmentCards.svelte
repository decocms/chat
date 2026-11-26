<script lang="ts">
  import Button from "../../lib/studio/Button.svelte";
  import IconButton from "../../lib/studio/IconButton.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import { composerError, type PendingAttachment } from "./model";
  /**
   * The files above a chat box, one card each: a preview for an image, the
   * name, where its upload is, and remove (retry after an error). The room's
   * composer and the Home's ask box both show them.
   */
  let {
    items,
    preview,
    t,
    onremove,
    onretry,
  }: {
    items: readonly PendingAttachment[];
    preview: (item: PendingAttachment) => string | undefined;
    t: (text: string, vars?: Record<string, string | number>) => string;
    onremove: (id: number, event: Event) => void;
    onretry?: (id: number, event: Event) => void;
  } = $props();
</script>

{#if items.length}<div class="flex flex-wrap gap-2 px-2 pt-2">
    {#each items as item (item.id)}{@const image = preview(item)}
      <div
        data-composer-attachment={item.id}
        class="relative flex w-32 flex-col gap-1 rounded-control bg-card p-2 shadow-edge transition-[opacity,scale] duration-150 ease-[var(--vb-ease-out-cubic)] starting:scale-95 starting:opacity-0"
      >
        {#if image}<img
            src={image}
            alt={item.name}
            class="h-20 w-full rounded-sm object-cover"
          />{:else}<Icon icon="file-02" size={16} />{/if}<span
          class="break-words text-xs">{item.name}</span
        ><span role="status" class="text-xs text-muted-foreground"
          >{item.phase === "queued" || item.phase === "uploading"
            ? t("Enviando…")
            : item.phase === "error"
              ? composerError(item.error || "failed", t)
              : t("Pronto")}</span
        >{#if item.phase === "error" && onretry}<Button
            size="sm"
            variant="outline"
            onclick={(event) => onretry(item.id, event)}
            >{t("Tentar novamente")}</Button
          >{/if}<IconButton
          label={t("Remover anexo")}
          size="icon-xs"
          class="absolute right-1 top-1 rounded-full bg-card shadow-edge"
          onclick={(event) => onremove(item.id, event)}
          ><Icon icon="x" size={14} /></IconButton
        >
      </div>{/each}
  </div>{/if}
