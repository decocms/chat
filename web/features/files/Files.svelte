<script lang="ts">
  import { onMount } from "svelte";
  import Button from "../../lib/studio/Button.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import { File02, Folder, Pin02, Upload01 } from "../../lib/studio/icons";
  import IconButton from "../../lib/studio/IconButton.svelte";
  import Spinner from "../../lib/studio/Spinner.svelte";
  import LoadingState from "../../lib/components/LoadingState.svelte";
  import PaneLoading from "../../lib/components/PaneLoading.svelte";
  import { filesModel, fileKinds } from "./model";
  import type { FilesProps } from "./types";
  import { kb } from "../../app/panels";
  import PaneEmpty from "../../lib/components/PaneEmpty.svelte";
  import PaneHeader from "../../lib/components/PaneHeader.svelte";
  import { paneIcons } from "../documents/paneIcons";
  let {
    room,
    vb,
    session,
    request,
    onopenfile,
    onfolderchange,
    ask,
    attach,
  }: FilesProps = $props();
  let picker = $state<HTMLInputElement | null>(null);
  let mounted = false;
  onMount(() => {
    mounted = true;
    return () => {
      mounted = false;
    };
  });
  const fileState = $derived(session.state);
  const view = $derived(
    filesModel(room, $fileState.kind, $fileState.directory),
  );
  $effect(() => {
    session.sync(room);
  });
  const issueText = (issue: string) =>
    issue === "unconfirmed"
      ? vb.t("Ainda não recebi a confirmação. Confira antes de tentar de novo.")
      : issue;
  function select(kind: string, dir: string, folder = false) {
    if (!mounted) return;
    session.select(kind, dir);
    if (folder) onfolderchange();
  }
</script>

<section
  data-view="files"
  class="flex flex-col gap-3 p-3 font-sans text-sm text-foreground"
  aria-label={vb.t("Arquivos")}
>
  {#if attach}<input
      bind:this={picker}
      type="file"
      multiple
      hidden
      onchange={(event) => {
        const files = [...(event.currentTarget.files ?? [])];
        event.currentTarget.value = "";
        if (mounted && files.length) attach(files);
      }}
    />{/if}
  {#snippet upload(small: boolean)}{#if attach}<Button
        variant={small ? "outline" : "default"}
        size={small ? "sm" : "default"}
        onclick={() => picker?.click()}
        ><Icon icon={Upload01} size={16} />{small
          ? vb.t("Enviar")
          : vb.t("Enviar arquivo")}</Button
      >{/if}{/snippet}
  {#snippet uploadSmall()}{@render upload(true)}{/snippet}
  {#snippet uploadLarge()}{@render upload(false)}{/snippet}
  <PaneHeader
    title={vb.t("Arquivos")}
    count={room.filesN ?? room.files?.length ?? 0}
    action={room.files?.length ? uploadSmall : undefined}
  />
  {#if room.files?.length}
    <!-- Kinds as small pills (the one you're on filled), then folders as compact chips, then a dense grid of
         tiles where the file comes first: a big preview, its name and one line of who/when; pin on hover. -->
    {#if view.counts.all > 1}<div
        class="-mx-3 flex gap-1.5 overflow-x-auto px-3 [scrollbar-width:none]"
        aria-label={vb.t("Arquivos")}
      >
        {#each fileKinds.filter(([kind]) => view.counts[kind]) as [kind, label]}
          <button
            type="button"
            data-fkind={kind}
            aria-pressed={view.kind === kind}
            class={[
              "inline-flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3 font-sans text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
              view.kind === kind
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-background text-foreground hover:bg-accent",
            ]}
            onclick={() => select(kind, view.dir)}
            >{vb.t(label)}<span
              class={view.kind === kind
                ? "opacity-70"
                : "text-muted-foreground"}>{view.counts[kind]}</span
            ></button
          >
        {/each}
      </div>{/if}
    {#if view.dir}<div class="flex min-w-0 items-center gap-1.5">
        <Button
          variant="ghost"
          size="sm"
          class="-ml-2"
          onclick={() =>
            select(
              view.kind,
              view.dir.includes("/")
                ? view.dir.slice(0, view.dir.lastIndexOf("/"))
                : "",
              true,
            )}>← {vb.t("voltar")}</Button
        ><Icon
          icon={Folder}
          size={16}
          class="shrink-0 text-muted-foreground"
        /><b class="truncate font-medium">{view.dir}/</b>
      </div>{/if}
    {#if view.folders.length}<div class="flex flex-wrap gap-1.5">
        {#each view.folders as [name, count]}<button
            type="button"
            data-fdir={view.prefix + name}
            class="inline-flex h-9 min-w-0 max-w-full cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-3 font-sans text-sm transition-colors outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
            onclick={() => select(view.kind, view.prefix + name, true)}
            ><Icon
              icon={Folder}
              size={16}
              class="shrink-0 text-muted-foreground"
            /><span class="truncate font-medium">{name}</span><span
              class="shrink-0 text-xs text-muted-foreground"
              title={count === 1
                ? vb.t("1 arquivo")
                : vb.t("{n} arquivos", { n: count })}>{count}</span
            ></button
          >{/each}
      </div>{/if}
    {#if view.list.length}<div
        class="grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-2"
      >
        {#each view.list as file (file.id)}
          {@const pinned =
            room.pins?.some(
              (pin) => pin.kind === "file" && pin.ref === file.id,
            ) ?? false}
          {@const ext = (file.name.split(".").pop() ?? "").slice(0, 4)}
          <article
            data-file-id={file.id}
            class="group/file relative min-w-0 overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-foreground/25"
          >
            <button
              type="button"
              class="block w-full min-w-0 cursor-pointer border-0 bg-transparent p-0 text-left font-sans text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
              title={file.name}
              onclick={(event) => {
                if (mounted && event.currentTarget.isConnected)
                  session.open(file, onopenfile);
              }}
            >
              <span
                class="flex aspect-[4/3] w-full items-center justify-center overflow-hidden border-b border-border bg-muted"
                >{#if file.type.startsWith("image/")}<img
                    class="size-full object-contain p-2"
                    src={`/api/books/${encodeURIComponent(room.id)}/files/${encodeURIComponent(file.id)}`}
                    alt={file.name}
                    loading="lazy"
                  />{:else}<span
                    class="flex flex-col items-center gap-1.5 text-muted-foreground"
                    ><Icon icon={File02} size={24} />{#if ext}<span
                        class="text-[0.6875rem] font-semibold tracking-wide uppercase"
                        >{ext}</span
                      >{/if}</span
                  >{/if}</span
              >
              <span class="flex flex-col gap-0.5 px-2.5 py-2"
                ><span class="truncate text-sm leading-5 font-medium"
                  >{file.name.slice(view.prefix.length)}</span
                ><span
                  class="truncate text-[0.6875rem] leading-4 text-muted-foreground"
                  >{vb.name(file.author)} · {vb.ago(file.ts)} · {(view.versions.get(
                    file.name,
                  ) ?? 0) > 1
                    ? vb.t("{n} versões", {
                        n: view.versions.get(file.name)!,
                      })
                    : kb(file.size)}</span
                ></span
              >
            </button>
            <IconButton
              label={vb.t(pinned ? "Desafixar" : "Fixar na lateral")}
              aria-pressed={pinned}
              size="icon-xs"
              disabled={!!$fileState.pending}
              aria-busy={$fileState.pending?.id === file.id || undefined}
              class={[
                "absolute top-1.5 right-1.5 bg-background/90 shadow-sm backdrop-blur-sm transition-opacity aria-pressed:text-foreground focus-visible:opacity-100 group-hover/file:opacity-100 [@media(hover:none)]:opacity-100",
                pinned ? "opacity-100" : "opacity-0",
              ].join(" ")}
              onclick={(event) => {
                if (mounted && event.currentTarget.isConnected)
                  void session.toggle(file, request);
              }}
              >{#if $fileState.pending?.id === file.id}<Spinner
                  size="xs"
                />{:else}<Icon icon={Pin02} size={14} />{/if}</IconButton
            >
          </article>
        {/each}
      </div>{/if}
    {#if !view.list.length && !view.folders.length}<p>
        {vb.t("Nada aqui.")}
      </p>{/if}
  {:else if !$fileState.loading && !$fileState.loadError}<PaneEmpty
      icon={paneIcons.files}
      title={vb.t("Nenhum arquivo ainda")}
      description={vb.t(
        "Tudo que for compartilhado nesta sala fica aqui: imagens, PDFs, áudios, HTML. Você também pode colar ou arrastar no chat.",
      )}
      action={attach ? uploadLarge : undefined}
      ask={vb.t("Sobe nesta sala capturas de tela do que você já fez.")}
      askLabel={vb.t("Peça pro seu Claude")}
      onask={ask}
    />{/if}
  {#if $fileState.loading}{#if room.files?.length}<LoadingState
        label={vb.t("Carregando…")}
      />{:else}<PaneLoading label={vb.t("Carregando…")} />{/if}{/if}
  {#if $fileState.loadError}<p role="alert" class="text-destructive">
      {issueText($fileState.loadError)}
    </p>
    <Button
      variant="outline"
      onclick={() => {
        if (mounted) void session.load(request);
      }}>{vb.t("Tentar novamente")}</Button
    >{/if}
  {#if $fileState.error}<p role="alert" class="text-destructive">
      {issueText($fileState.error)}
    </p>{/if}
</section>
