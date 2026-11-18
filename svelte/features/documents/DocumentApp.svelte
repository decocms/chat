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
  class="tw:-mx-4 tw:my-3 tw:w-[calc(100%+2rem)] tw:min-w-0 tw:max-w-none tw:overflow-hidden tw:border-y tw:border-border"
>
  <!-- Edge to edge in the doc (its body pads 1rem): the app gets the doc's whole width (Gui #3115). -->
  <header
    class="tw:flex tw:items-center tw:gap-2 tw:bg-muted tw:px-4 tw:py-1.5"
  >
    <b class="tw:min-w-0 tw:flex-1 tw:truncate">{marker.tool}</b>
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
              class="tw:w-auto"><SelectValue /></SelectTrigger
            ><SelectContent data-vb-native class="tw:font-sans"
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
