<script lang="ts">
  import { onDestroy, untrack } from "svelte";
  import AppFrame from "../apps/AppFrame.svelte";
  import { createAppsSession } from "../apps/session";
  import { appIdentity } from "../apps/model";
  import type { AppsProps } from "../apps/types";
  import { documentAppKey } from "./appMarkers";
  import type { DocumentAppMarker, DocumentAppSize } from "./appMarkers";
  import Button from "../../lib/ui/Button.svelte";
  import Snapshot from "../../lib/ui/Snapshot.svelte";
  let {
    props,
    marker,
    source,
    current,
    resize,
    open,
  }: {
    props: AppsProps;
    marker: DocumentAppMarker;
    source: string;
    current(key: string): boolean;
    resize(
      source: string,
      marker: DocumentAppMarker,
      size: DocumentAppSize,
    ): void;
    open(): void;
  } = $props();
  let active = true;
  const markerKey = untrack(() => documentAppKey(marker));
  const owner = untrack(() =>
    createAppsSession(props.api, {
      current: () => active && current(markerKey) && props.current(),
      navigate: props.openLink,
      denied: () => props.owner.revoke(),
    }),
  );
  const view = owner.state;
  const target = untrack(() => ({
    connection: marker.connection,
    tool: marker.tool,
  }));
  owner.sync(untrack(() => props.room));
  owner.open(target);
  owner.loadFiles(untrack(() => props.request));
  $effect(() => owner.sync(props.room));
  const frameProps: AppsProps = $derived({
    ...props,
    owner,
    current: () => active && current(markerKey) && props.current(),
  });
  const identity = $derived(
    $view.room && $view.connections !== null
      ? appIdentity($view.room, $view.connections, target)
      : null,
  );
  onDestroy(() => {
    active = false;
    owner.dispose();
  });
  function connected(event: Event) {
    return (
      active &&
      current(markerKey) &&
      event.currentTarget instanceof HTMLElement &&
      event.currentTarget.isConnected
    );
  }
</script>

<section
  data-document-app
  class="tw:my-3 tw:overflow-hidden tw:rounded-control tw:border tw:border-border"
>
  <header class="tw:flex tw:items-center tw:gap-2 tw:bg-muted tw:px-3 tw:py-2">
    <b class="tw:min-w-0 tw:flex-1 tw:truncate">{marker.tool}</b>
    {#key source}<Snapshot value={{ source, marker }}
        >{#snippet children(rendered)}<div
            role="group"
            aria-label={props.t("Tamanho")}
            class="tw:flex tw:gap-1"
          >
            {#each ["p", "m", "g"] as size}<Button
                variant={marker.size === size ? "secondary" : "ghost"}
                onclick={(event) => {
                  if (
                    connected(event) &&
                    (size === "p" || size === "m" || size === "g")
                  )
                    resize(rendered.source, rendered.marker, size);
                }}>{size.toUpperCase()}</Button
              >{/each}
          </div>{/snippet}</Snapshot
      >{/key}
    <Button
      variant="ghost"
      onclick={(event) => {
        if (connected(event)) open();
      }}>{props.t("Abrir no painel Apps")}</Button
    >
  </header>
  <div
    class={marker.size === "p"
      ? "tw:flex tw:h-60 tw:flex-col"
      : marker.size === "g"
        ? "tw:flex tw:h-[680px] tw:flex-col"
        : "tw:flex tw:h-[420px] tw:flex-col"}
  >
    {#if identity}{#key identity + ":" + $view.frameRevision}<AppFrame
          props={frameProps}
          inline
        />{/key}
    {:else if $view.loading || $view.connections === null}<p
        role="status"
        class="tw:p-3"
      >
        {props.t("Carregando…")}
      </p>
    {:else}<div class="tw:p-3">
        <p role="alert">
          {$view.error ||
            props.t(
              "Esse app não está nas conexões que você pode usar nesta sala.",
            )}
        </p>
        <Button
          onclick={(event) => {
            if (connected(event)) {
              owner.load();
              owner.loadFiles(props.request, true);
            }
          }}>{props.t("Tentar de novo")}</Button
        >
      </div>{/if}
  </div>
</section>
