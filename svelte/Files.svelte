<script lang="ts">
  import { onMount } from "svelte";
  import Button from "./lib/studio/Button.svelte";
  import Icon from "./lib/studio/Icon.svelte";
  import { File02, Folder, Pin02, Upload01 } from "./lib/studio/icons";
  import IconButton from "./lib/studio/IconButton.svelte";
  import Spinner from "./lib/studio/Spinner.svelte";
  import LoadingState from "./lib/components/LoadingState.svelte";
  import PaneLoading from "./lib/components/PaneLoading.svelte";
  import { filesModel, fileKinds } from "./features/files/model";
  import type { FilesProps } from "./features/files/types";
  import { kb } from "./panels";
  import PaneEmpty from "./lib/components/PaneEmpty.svelte";
  import PaneHeader from "./lib/components/PaneHeader.svelte";
  import { paneIcons } from "./features/documents/paneIcons";
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
  data-vb-native="files"
  class="tw:flex tw:flex-col tw:gap-3 tw:p-3 tw:font-sans tw:text-sm tw:text-foreground"
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
        class="tw:-mx-3 tw:flex tw:gap-1.5 tw:overflow-x-auto tw:px-3 tw:[scrollbar-width:none]"
        aria-label={vb.t("Arquivos")}
      >
        {#each fileKinds.filter(([kind]) => view.counts[kind]) as [kind, label]}
          <button
            type="button"
            data-fkind={kind}
            aria-pressed={view.kind === kind}
            class={[
              "tw:inline-flex tw:h-7 tw:shrink-0 tw:cursor-pointer tw:items-center tw:gap-1.5 tw:rounded-full tw:border tw:px-3 tw:font-sans tw:text-xs tw:font-medium tw:transition-colors tw:outline-none tw:focus-visible:ring-2 tw:focus-visible:ring-ring",
              view.kind === kind
                ? "tw:border-foreground tw:bg-foreground tw:text-background"
                : "tw:border-border tw:bg-background tw:text-foreground tw:hover:bg-accent",
            ]}
            onclick={() => select(kind, view.dir)}
            >{vb.t(label)}<span
              class={view.kind === kind
                ? "tw:opacity-70"
                : "tw:text-muted-foreground"}>{view.counts[kind]}</span
            ></button
          >
        {/each}
      </div>{/if}
    {#if view.dir}<div class="tw:flex tw:min-w-0 tw:items-center tw:gap-1.5">
        <Button
          variant="ghost"
          size="sm"
          class="tw:-ml-2"
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
          class="tw:shrink-0 tw:text-muted-foreground"
        /><b class="tw:truncate tw:font-medium">{view.dir}/</b>
      </div>{/if}
    {#if view.folders.length}<div class="tw:flex tw:flex-wrap tw:gap-1.5">
        {#each view.folders as [name, count]}<button
            type="button"
            data-fdir={view.prefix + name}
            class="tw:inline-flex tw:h-9 tw:min-w-0 tw:max-w-full tw:cursor-pointer tw:items-center tw:gap-2 tw:rounded-lg tw:border tw:border-border tw:bg-background tw:px-3 tw:font-sans tw:text-[0.8125rem] tw:transition-colors tw:outline-none tw:hover:bg-accent tw:focus-visible:ring-2 tw:focus-visible:ring-ring"
            onclick={() => select(view.kind, view.prefix + name, true)}
            ><Icon
              icon={Folder}
              size={16}
              class="tw:shrink-0 tw:text-muted-foreground"
            /><span class="tw:truncate tw:font-medium">{name}</span><span
              class="tw:shrink-0 tw:text-xs tw:text-muted-foreground"
              title={count === 1
                ? vb.t("1 arquivo")
                : vb.t("{n} arquivos", { n: count })}>{count}</span
            ></button
          >{/each}
      </div>{/if}
    {#if view.list.length}<div
        class="tw:grid tw:grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] tw:gap-2"
      >
        {#each view.list as file (file.id)}
          {@const pinned =
            room.pins?.some(
              (pin) => pin.kind === "file" && pin.ref === file.id,
            ) ?? false}
          {@const ext = (file.name.split(".").pop() ?? "").slice(0, 4)}
          <article
            data-file-id={file.id}
            class="tw:group/file tw:relative tw:min-w-0 tw:overflow-hidden tw:rounded-lg tw:border tw:border-border tw:bg-card tw:transition-colors tw:hover:border-foreground/25"
          >
            <button
              type="button"
              class="tw:block tw:w-full tw:min-w-0 tw:cursor-pointer tw:border-0 tw:bg-transparent tw:p-0 tw:text-left tw:font-sans tw:text-foreground tw:outline-none tw:focus-visible:ring-2 tw:focus-visible:ring-ring tw:focus-visible:ring-inset"
              title={file.name}
              onclick={(event) => {
                if (mounted && event.currentTarget.isConnected)
                  session.open(file, onopenfile);
              }}
            >
              <span
                class="tw:flex tw:aspect-[4/3] tw:w-full tw:items-center tw:justify-center tw:overflow-hidden tw:border-b tw:border-border tw:bg-muted"
                >{#if file.type.startsWith("image/")}<img
                    class="tw:size-full tw:object-contain tw:p-2"
                    src={`/api/books/${encodeURIComponent(room.id)}/files/${encodeURIComponent(file.id)}`}
                    alt={file.name}
                    loading="lazy"
                  />{:else}<span
                    class="tw:flex tw:flex-col tw:items-center tw:gap-1.5 tw:text-muted-foreground"
                    ><Icon icon={File02} size={24} />{#if ext}<span
                        class="tw:text-[0.6875rem] tw:font-semibold tw:tracking-wide tw:uppercase"
                        >{ext}</span
                      >{/if}</span
                  >{/if}</span
              >
              <span class="tw:flex tw:flex-col tw:gap-0.5 tw:px-2.5 tw:py-2"
                ><span
                  class="tw:truncate tw:text-[0.8125rem] tw:leading-5 tw:font-medium"
                  >{file.name.slice(view.prefix.length)}</span
                ><span
                  class="tw:truncate tw:text-[0.6875rem] tw:leading-4 tw:text-muted-foreground"
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
                "tw:absolute tw:top-1.5 tw:right-1.5 tw:bg-background/90 tw:shadow-sm tw:backdrop-blur-sm tw:transition-opacity tw:aria-pressed:text-foreground tw:focus-visible:opacity-100 tw:group-hover/file:opacity-100 tw:[@media(hover:none)]:opacity-100",
                pinned ? "tw:opacity-100" : "tw:opacity-0",
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
  {#if $fileState.loadError}<p role="alert" class="tw:text-destructive">
      {issueText($fileState.loadError)}
    </p>
    <Button
      variant="outline"
      onclick={() => {
        if (mounted) void session.load(request);
      }}>{vb.t("Tentar novamente")}</Button
    >{/if}
  {#if $fileState.error}<p role="alert" class="tw:text-destructive">
      {issueText($fileState.error)}
    </p>{/if}
</section>
