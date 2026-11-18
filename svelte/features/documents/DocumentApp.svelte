<script lang="ts">
  import { onDestroy, untrack } from "svelte";
  import AppFrame from "../apps/AppFrame.svelte";
  import { createAppsSession } from "../apps/session";
  import { appIdentity } from "../apps/model";
  import type { AppsProps } from "../apps/types";
  import { documentAppKey } from "./appMarkers";
  import type { DocumentAppMarker, DocumentAppSize } from "./appMarkers";
  import Button from "../../lib/studio/Button.svelte";
  import IconButton from "../../lib/studio/IconButton.svelte";
  import Select from "../../lib/studio/Select.svelte";
  import SelectTrigger from "../../lib/studio/SelectTrigger.svelte";
  import SelectValue from "../../lib/studio/SelectValue.svelte";
  import SelectContent from "../../lib/studio/SelectContent.svelte";
  import SelectItem from "../../lib/studio/SelectItem.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import { LinkExternal01 } from "../../lib/studio/icons";
  import Snapshot from "../../lib/components/Snapshot.svelte";
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
  const sizes = $derived([
    { value: "p", label: props.t("Pequeno") },
    { value: "m", label: props.t("Médio") },
    { value: "g", label: props.t("Grande") },
  ]);
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
  class="-mx-4 my-3 w-[calc(100%+2rem)] min-w-0 max-w-none overflow-hidden border-y border-border"
>
  <!-- Edge to edge in the doc (its body pads 1rem): the app gets the doc's whole width (Gui #3115). -->
  <header class="flex items-center gap-2 bg-muted px-4 py-1.5">
    <b class="min-w-0 flex-1 truncate">{marker.tool}</b>
    {#key source}<Snapshot value={{ source, marker }}
        >{#snippet children(
          rendered,
        )}<!-- One select for the height (Gui #3153), not three buttons. --><Select
            items={sizes}
            bind:value={
              () => rendered.marker.size,
              (size) => {
                if (
                  active &&
                  current(markerKey) &&
                  (size === "p" || size === "m" || size === "g")
                )
                  resize(rendered.source, rendered.marker, size);
              }
            }
            ><SelectTrigger
              size="xs"
              aria-label={props.t("Tamanho")}
              class="w-auto"><SelectValue /></SelectTrigger
            ><SelectContent data-vb-native class="font-sans"
              >{#each sizes as item (item.value)}<SelectItem
                  value={item.value}
                  label={item.label}>{item.label}</SelectItem
                >{/each}</SelectContent
            ></Select
          >{/snippet}</Snapshot
      >{/key}
    <IconButton
      label={props.t("Abrir no painel Apps")}
      onclick={(event) => {
        if (connected(event)) open();
      }}><Icon icon={LinkExternal01} /></IconButton
    >
  </header>
  <div
    class={marker.size === "p"
      ? "flex h-60 flex-col"
      : marker.size === "g"
        ? "flex h-[680px] flex-col"
        : "flex h-[420px] flex-col"}
  >
    {#if identity}{#key identity + ":" + $view.frameRevision}<AppFrame
          props={frameProps}
          inline
        />{/key}
    {:else if $view.loading || $view.connections === null}<p
        role="status"
        class="p-3"
      >
        {props.t("Carregando…")}
      </p>
    {:else}<div class="p-3">
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
