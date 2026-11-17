<script lang="ts">
  import { onMount } from "svelte";
  import Button from "./lib/studio/Button.svelte";
  import Icon from "./lib/studio/Icon.svelte";
  import { File02, Folder, Pin02 } from "./lib/studio/icons";
  import IconButton from "./lib/studio/IconButton.svelte";
  import Spinner from "./lib/studio/Spinner.svelte";
  import { filesModel, fileKinds } from "./features/files/model";
  import type { FilesProps } from "./features/files/types";
  import { kb } from "./panels";
  let { room, vb, session, request, onopenfile, onfolderchange }: FilesProps =
    $props();
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
  {#if room.files?.length}
    {#if view.counts.all > 1}<div
        class="tw:flex tw:flex-wrap tw:gap-1"
        aria-label={vb.t("Arquivos")}
      >
        {#each fileKinds.filter(([kind]) => view.counts[kind]) as [kind, label]}
          <Button
            variant={view.kind === kind ? "secondary" : "ghost"}
            size="sm"
            data-fkind={kind}
            aria-pressed={view.kind === kind}
            onclick={() => select(kind, view.dir)}
            >{vb.t(label)} <small>{view.counts[kind]}</small></Button
          >
        {/each}
      </div>{/if}
    {#if view.dir}<div class="tw:flex tw:items-center tw:gap-2">
        <Button
          variant="ghost"
          size="sm"
          onclick={() =>
            select(
              view.kind,
              view.dir.includes("/")
                ? view.dir.slice(0, view.dir.lastIndexOf("/"))
                : "",
              true,
            )}>← {vb.t("voltar")}</Button
        ><Icon icon={Folder} size={16} /><b>{view.dir}/</b>
      </div>{/if}
    <div class="tw:grid tw:grid-cols-2 tw:gap-3 tw:sm:grid-cols-3">
      {#each view.folders as [name, count]}<Button
          data-fdir={view.prefix + name}
          variant="outline"
          class="tw:h-auto tw:min-w-0 tw:flex-col tw:items-start tw:justify-start tw:gap-2 tw:whitespace-normal tw:rounded-lg tw:p-3 tw:text-left"
          onclick={() => select(view.kind, view.prefix + name, true)}
          ><Icon icon={Folder} size={16} class="tw:size-8" /><b
            class="tw:break-all">{name}/</b
          ><small class="tw:text-muted-foreground"
            >{count === 1
              ? vb.t("1 arquivo")
              : vb.t("{n} arquivos", { n: count })}</small
          ></Button
        >{/each}
      {#each view.list as file (file.id)}
        {@const pinned =
          room.pins?.some(
            (pin) => pin.kind === "file" && pin.ref === file.id,
          ) ?? false}
        <article
          data-file-id={file.id}
          class="tw:min-w-0 tw:rounded-lg tw:border tw:border-border tw:bg-card tw:p-3"
        >
          <Button
            variant="ghost"
            class="tw:h-auto tw:w-full tw:min-w-0 tw:flex-col tw:items-start tw:gap-2 tw:whitespace-normal tw:p-0 tw:text-left"
            title={file.name}
            onclick={(event) => {
              if (mounted && event.currentTarget.isConnected)
                session.open(file, onopenfile);
            }}
          >
            {#if file.type.startsWith("image/")}<img
                class="tw:h-24 tw:w-full tw:rounded-md tw:object-contain"
                src={`/api/books/${encodeURIComponent(room.id)}/files/${encodeURIComponent(file.id)}`}
                alt={file.name}
                loading="lazy"
              />{:else}<Icon icon={File02} size={16} class="tw:size-8" />{/if}
            <b class="tw:break-all">{file.name.slice(view.prefix.length)}</b
            ><small class="tw:text-muted-foreground"
              >{vb.name(file.author)} · {vb.ago(file.ts)} · {(view.versions.get(
                file.name,
              ) ?? 0) > 1
                ? vb.t("{n} versões", { n: view.versions.get(file.name)! })
                : kb(file.size)}</small
            >
          </Button>
          <IconButton
            label={vb.t(pinned ? "Desafixar" : "Fixar na lateral")}
            aria-pressed={pinned}
            disabled={!!$fileState.pending}
            aria-busy={$fileState.pending?.id === file.id || undefined}
            class="tw:aria-pressed:bg-accent tw:aria-pressed:text-foreground"
            onclick={(event) => {
              if (mounted && event.currentTarget.isConnected)
                void session.toggle(file, request);
            }}
            >{#if $fileState.pending?.id === file.id}<Spinner
                size="xs"
              />{:else}<Icon icon={Pin02} size={16} />{/if}</IconButton
          >
        </article>
      {/each}
    </div>
    {#if !view.list.length && !view.folders.length}<p>
        {vb.t("Nada aqui.")}
      </p>{/if}
  {:else if !$fileState.loading && !$fileState.loadError}<p>
      {vb.t(
        "Cole uma imagem no chat (Cmd+V), arraste um arquivo ou use o clipe. Tudo que for enviado neste vibebook fica aqui.",
      )}
    </p>{/if}
  {#if $fileState.loading}<p role="status">{vb.t("Carregando…")}</p>{/if}
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
