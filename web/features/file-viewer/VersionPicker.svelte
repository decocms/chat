<script lang="ts">
  import { untrack } from "svelte";
  import type { FileViewer } from "./session";
  import Select from "../../lib/studio/Select.svelte";
  import SelectContent from "../../lib/studio/SelectContent.svelte";
  import SelectItem from "../../lib/studio/SelectItem.svelte";
  import SelectTrigger from "../../lib/studio/SelectTrigger.svelte";
  import SelectValue from "../../lib/studio/SelectValue.svelte";
  import { viewerText } from "./copy";
  /** A file's versions as one small picker, for a title row (full screen, or the panel beside the chat). Nothing when there is one version. */
  let {
    controller,
    lang = "pt",
    onselect,
  }: {
    controller: FileViewer;
    lang?: "pt" | "en";
    onselect?(id: string): void;
  } = $props();
  const view = untrack(() => controller.state);
  let trigger = $state<HTMLElement | null>(null);
  const label = $derived(viewerText(lang, "version"));
  const versions = $derived(
    $view.versions.map((file, index) => ({
      value: file.id,
      label: `v${$view.versions.length - index} · ${new Date(file.ts).toLocaleString(lang === "en" ? "en" : "pt-BR")}`,
    })),
  );
</script>

{#if $view.target && versions.length > 1}<label
    class="flex max-w-[55%] min-w-0 shrink items-center text-sm"
    ><span class="sr-only">{label}</span>
    <Select
      items={versions}
      bind:value={
        () => $view.target?.id ?? "",
        (id) => {
          if (
            trigger?.isConnected &&
            trigger.dataset.fileVersionTarget === $view.target?.id
          )
            onselect ? onselect(id) : controller.select(id);
        }
      }
    >
      <SelectTrigger
        bind:ref={trigger}
        aria-label={label}
        data-file-version-target={$view.target.id}
        size="sm"
        class="w-auto max-w-full min-w-0"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent class="font-sans">
        {#each versions as version (version.value)}<SelectItem
            value={version.value}
            label={version.label}>{version.label}</SelectItem
          >{/each}
      </SelectContent>
    </Select>
  </label>{/if}
