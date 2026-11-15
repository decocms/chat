<script lang="ts">
  import { onDestroy, untrack, type ComponentProps } from "svelte";
  import type DocumentCard from "./DocumentCard.svelte";
  import { createDeferredModule } from "../deferred-view/module";
  import DeferredViewStatus from "../deferred-view/DeferredViewStatus.svelte";
  let {
    current,
    lang,
    ...props
  }: ComponentProps<typeof DocumentCard> & {
    current(): boolean;
    lang: string;
  } = $props();
  let active = true;
  const owns = untrack(() => current);
  const loader = createDeferredModule(
    () => import("./DocumentCard.svelte").then((module) => module.default),
    { current: () => active && owns() },
  );
  const view = loader.state;
  loader.ensure();
  onDestroy(() => {
    active = false;
    loader.dispose();
  });
</script>

{#if $view.component}{@const Card = $view.component}<Card
    {...props}
  />{:else}<DeferredViewStatus
    phase={$view.phase}
    label={lang === "en" ? "Document card" : "Card do documento"}
    {current}
    lang={lang === "en" ? "en" : "pt"}
    retry={() => loader.retry()}
  />{/if}
