<script lang="ts">
  import { onDestroy, untrack } from "svelte";
  import type { FileViewer } from "./session";
  import type { RichActions } from "../rich-text/types";
  import RichContent from "../rich-text/RichContent.svelte";
  import Dialog from "../../lib/studio/Dialog.svelte";
  import DialogContent from "../../lib/studio/DialogContent.svelte";
  import DialogHeader from "../../lib/studio/DialogHeader.svelte";
  import DialogTitle from "../../lib/studio/DialogTitle.svelte";
  import Button from "../../lib/studio/Button.svelte";
  import { buttonVariants } from "../../lib/studio/button";
  import IconButton from "../../lib/studio/IconButton.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import ViewerMedia from "./ViewerMedia.svelte";
  import VersionPicker from "./VersionPicker.svelte";
  import { csvData, externalFileURL, fileURL, viewerKind } from "./model";
  import { viewerText } from "./copy";
  let {
    controller,
    lang = "pt",
    actions,
    iosStandalone = false,
    inline = false,
    onselect,
    onclose,
  }: {
    controller: FileViewer;
    lang?: "pt" | "en";
    actions: RichActions;
    iosStandalone?: boolean;
    inline?: boolean;
    onselect?(id: string): void;
    onclose?(): void;
  } = $props();
  const view = untrack(() => controller.state);
  const close = () => (onclose ? onclose() : controller.closeUser());
  const text = (key: Parameters<typeof viewerText>[1]) => viewerText(lang, key);
  let csvPage = $state(0);
  const csvText = $derived(
    $view.content?.kind === "csv" ? ($view.content.text ?? "") : null,
  );
  const csv = $derived(
    csvText === null ? { rows: [], truncated: false } : csvData(csvText),
  );
  const headers = $derived(
    Array.from(
      {
        length: csv.rows.reduce((count, row) => Math.max(count, row.length), 0),
      },
      (_, index) => csv.rows[0]?.[index] ?? "",
    ),
  );
  const rows = $derived(
    csv.rows.slice(csvPage * 19 + 1, (csvPage + 1) * 19 + 1),
  );
  $effect(() => {
    void $view.content?.operation;
    csvPage = 0;
  });
  /** An image opens in the design system's own small dialog, sized to the image (Gimenes #5599); other files keep the large viewer. Known from the file's metadata, so the size does not jump when the content arrives. */
  const image = $derived(
    ($view.file
      ? viewerKind($view.file.type, $view.file.name)
      : $view.content?.kind) === "image",
  );
  const locale = $derived(lang === "en" ? "en" : "pt-BR");
  const sent = $derived.by(() => {
    const file = $view.file;
    if (!file) return "";
    const who = $view.room?.names?.[file.author] ?? file.author.split("@")[0];
    const when = new Date(file.ts).toLocaleString(locale, {
      dateStyle: "short",
      timeStyle: "short",
    });
    return `${who} · ${when}`;
  });
  const size = $derived.by(() => {
    const bytes = $view.file?.size;
    if (!bytes) return "";
    const mega = bytes >= 1_000_000;
    return new Intl.NumberFormat(locale, {
      style: "unit",
      unit: mega ? "megabyte" : "kilobyte",
      maximumFractionDigits: 1,
    }).format(bytes / (mega ? 1_000_000 : 1_000));
  });
  let content = $state<HTMLElement | null>(null);
  const pinned = $derived(
    $view.room?.pins?.some(
      (pin) => pin.kind === "file" && pin.ref === $view.target?.id,
    ),
  );
  const ownedActions: RichActions = $derived.by(() => {
    const ticket = $view.content?.operation;
    const owned = () => ticket !== undefined && controller.current(ticket);
    const leave = (callback: () => void) => {
      if (!owned()) return;
      close();
      if (!controller.deferNavigation(callback)) callback();
    };
    return {
      navigate: (id, thread) => leave(() => actions.navigate(id, thread)),
      openFile: (file) => {
        if (owned()) actions.openFile(file);
      },
      navigateRich: (target) => leave(() => actions.navigateRich?.(target)),
      openFileReference: (file) => {
        if (owned()) actions.openFileReference?.(file);
      },
      openAppLink: (link) => leave(() => actions.openAppLink?.(link)),
    };
  });
  onDestroy(() => controller.closeNavigation());
</script>

<!-- The version picker and the file's actions: one compact row, in the full-screen title bar or (only the picker) beside the chat, whose panel header has the rest. -->
{#snippet tools()}
  {#if $view.target}
    <VersionPicker {controller} {lang} {onselect} />
    {#if !inline && $view.file}<IconButton
        label={pinned ? text("unpin") : text("pin")}
        tooltipSide="bottom"
        size="icon"
        aria-pressed={pinned}
        class={pinned
          ? "bg-muted text-foreground"
          : "text-muted-foreground hover:text-foreground"}
        disabled={$view.pinPending}
        onclick={(event) => {
          if (event.currentTarget.isConnected) controller.togglePin();
        }}><Icon icon="pin-02" size={18} /></IconButton
      >{/if}
    {#if !inline}<IconButton
        label={text("external")}
        tooltipSide="bottom"
        size="icon"
        class="text-muted-foreground hover:text-foreground"
        href={externalFileURL($view.target, location.origin, iosStandalone)}
        target="_blank"
        rel="noopener noreferrer"
        ><Icon icon="link-external-01" size={18} /></IconButton
      >{/if}
  {/if}
{/snippet}
{#snippet preview()}
  {#if $view.target}
    <div
      data-file-viewer
      data-file-id={$view.target.id}
      class="flex min-h-0 flex-1 flex-col gap-4"
    >
      {#if $view.indexPending}<p
          role="status"
          class="m-0 text-sm text-muted-foreground"
        >
          {text("history")}
        </p>{/if}
      {#if $view.indexError}<div class="flex flex-wrap items-center gap-2">
          <p role="alert" class="m-0 text-sm text-destructive">
            {text("historyError")}
          </p>
          <Button
            variant="outline"
            onclick={(event) => {
              if (event.currentTarget.isConnected) controller.retryIndex();
            }}>{text("retryHistory")}</Button
          >
        </div>{/if}
      {#if $view.pinError}<p role="alert" class="m-0 text-sm text-destructive">
          {text("pinError")}
        </p>{/if}
      {#if $view.phase === "loading"}<p
          role="status"
          class="m-0 text-muted-foreground"
        >
          {text("loading")}
        </p>{/if}
      {#if $view.phase === "error"}
        <p role="alert" class="m-0 text-destructive">
          {text(
            $view.error === "missing"
              ? "missing"
              : $view.error === "metadata-changed"
                ? "changed"
                : ["signed-out", "forbidden"].includes($view.error)
                  ? "denied"
                  : $view.error === "read-timeout"
                    ? "timeout"
                    : "unavailable",
          )}
        </p>
        {#if ["signed-out", "forbidden"].includes($view.error)}<a
            href={fileURL($view.target)}
            class={buttonVariants()}>{text("access")}</a
          >
        {:else if !["missing", "metadata-changed"].includes($view.error)}<Button
            variant="outline"
            onclick={(event) => {
              if (event.currentTarget.isConnected) controller.retry();
            }}>{text("retry")}</Button
          >{/if}
      {:else if $view.content}
        {#key $view.content.operation}
          {#if ["image", "audio", "html", "pdf"].includes($view.content.kind)}
            {@const operation = $view.content.operation}
            <ViewerMedia
              content={$view.content}
              name={$view.name}
              onready={() => controller.ready(operation)}
              onerror={() => controller.mediaError(operation)}
              onclose={() => {
                if (controller.current(operation)) close();
              }}
            />
          {:else if $view.content.kind === "markdown" && $view.room && $view.phase === "ready"}<RichContent
              text={$view.content.text ?? ""}
              room={$view.room}
              actions={ownedActions}
              policy="file-preview"
              fileLabel={text("file")}
              pageUrl={location.href}
            />
          {:else if $view.content.kind === "csv" && $view.phase === "ready"}<div
              class="max-w-full overflow-auto"
            >
              <table class="w-full border-collapse text-left text-sm">
                <thead
                  ><tr
                    >{#each headers as cell, index}<th
                        scope="col"
                        aria-label={cell.trim()
                          ? undefined
                          : `${text("column")} ${index + 1}`}
                        class="whitespace-pre-wrap border border-border p-2 font-semibold"
                        >{cell}</th
                      >{/each}</tr
                  ></thead
                >
                <tbody
                  >{#each rows as row}<tr
                      >{#each row as cell}<td
                          class="whitespace-pre-wrap border border-border p-2"
                          >{cell}</td
                        >{/each}</tr
                    >{/each}</tbody
                >
              </table>
            </div>
          {:else if $view.content.kind === "text" && $view.phase === "ready"}<pre
              class="m-0 max-w-full overflow-auto whitespace-pre-wrap break-words font-mono text-sm">{$view
                .content.text}</pre>
          {:else if $view.content.kind === "download"}<a
              href={fileURL($view.target)}
              target="_blank"
              rel="noopener noreferrer"
              class={buttonVariants()}>{text("download")}</a
            >{/if}
        {/key}
        {#if $view.content.kind === "csv" && csv.rows.length > 20}<nav
            aria-label={text("rows")}
            class="flex flex-wrap items-center gap-2"
          >
            <Button
              variant="outline"
              disabled={csvPage === 0}
              onclick={(event) => {
                if (event.currentTarget.isConnected)
                  csvPage = Math.max(0, csvPage - 1);
              }}>{text("previous")}</Button
            ><span
              >{text("rows")}
              {csvPage * 19 + 2}–{Math.min(
                (csvPage + 1) * 19 + 1,
                csv.rows.length,
              )} /
              {csv.rows.length}</span
            ><Button
              variant="outline"
              disabled={(csvPage + 1) * 19 + 1 >= csv.rows.length}
              onclick={(event) => {
                if (event.currentTarget.isConnected) csvPage++;
              }}>{text("next")}</Button
            >
          </nav>{/if}
        {#if $view.content.truncated || ($view.content.kind === "csv" && csv.truncated)}<p
            role="status"
            class="m-0 text-sm text-muted-foreground"
          >
            {text("truncated")}
          </p>{/if}
      {/if}
    </div>
  {/if}
{/snippet}
{#if inline}{@render preview()}{:else}
  <Dialog
    open={$view.open}
    onOpenChange={(open) => {
      if (!open) close();
    }}
  >
    <DialogContent
      bind:ref={content}
      data-image-preview={image || undefined}
      class={image
        ? "flex max-h-[90dvh] w-full max-w-[90vw] flex-col gap-3 overflow-auto p-4 md:max-w-xl font-sans text-sm text-foreground"
        : "inset-2 top-2 left-2 flex w-auto max-w-none translate-x-0 translate-y-0 flex-col overflow-auto md:max-w-none font-sans text-sm text-foreground"}
      closeButtonClassName={image ? "top-4 right-4" : undefined}
      closeLabel={text("close")}
      preventScroll={false}
      preventBodyPointerEvents={false}
      preventOverflowTextSelection={false}
      onOpenAutoFocus={(event) => {
        // The dialog itself, not its first button: that button's tooltip would open and take the first Esc (Gimenes #5585).
        event.preventDefault();
        content?.focus();
      }}
      onCloseAutoFocus={(event) => {
        const target = controller.returnFocus();
        if (target?.isConnected) {
          event.preventDefault();
          target.focus();
        }
      }}
    >
      <DialogHeader class="flex-row items-center gap-1 space-y-0 pr-8">
        <DialogTitle class="min-w-0 flex-1 truncate font-sans"
          >{$view.name || "File"}</DialogTitle
        >
        {@render tools()}
      </DialogHeader>
      {@render preview()}
      {#if image && sent}<p
          class="m-0 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground"
        >
          <span>{sent}</span>{#if size}<span>{size}</span>{/if}
        </p>{/if}
    </DialogContent>
  </Dialog>{/if}

{#if $view.closingUnconfirmed}<div
    role="alert"
    class="fixed inset-x-4 top-4 z-50 flex flex-wrap items-center gap-3 rounded-surface border border-border bg-card p-4 font-sans text-sm text-card-foreground shadow-lg"
  >
    <p class="m-0 flex-1">{text("closing")}</p>
    <Button
      onclick={(event) => {
        if (event.currentTarget.isConnected) location.reload();
      }}>{text("reload")}</Button
    >
  </div>{/if}
