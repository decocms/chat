<script lang="ts">
  import Button from "../../lib/studio/Button.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import type { IconName } from "../../lib/studio/icons";
  import { homeText, type HomeCopyKey, type HomeLanguage } from "./copy";
  import { enter } from "./enter";
  /**
   * The Inbox at zero: two ways to start. Each writes the start of an ask
   * into the ask box (you finish it and send). Rows in the desktop list,
   * chips over a phone's docked ask box. Their names say it all: no label, no preview.
   */
  let {
    lang,
    layout = "rows",
    onstart,
  }: {
    lang: HomeLanguage;
    layout?: "rows" | "chips";
    onstart: (text: string) => void;
  } = $props();
  const starters: {
    id: string;
    icon: IconName;
    label: HomeCopyKey;
    text: HomeCopyKey;
  }[] = [
    {
      id: "catch-up",
      icon: "file-06",
      label: "starterCatchUp",
      text: "starterCatchUpText",
    },
    {
      id: "task",
      icon: "check-circle",
      label: "starterTask",
      text: "starterTaskText",
    },
  ];
</script>

{#if layout === "rows"}<section
    data-ask-starters="rows"
    aria-label={homeText(lang, "clearStart")}
    class="flex flex-col"
  >
    {#each starters as starter, index (starter.id)}<button
        type="button"
        data-ask-starter={starter.id}
        class="flex h-11 w-full min-w-0 cursor-pointer items-center gap-3 rounded-lg border-0 bg-transparent px-3 text-left font-sans text-foreground outline-none transition-[background-color,transform] duration-150 ease-[var(--vb-ease-out-quint)] hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97] motion-reduce:active:scale-100 {enter(
          index,
        )}"
        onclick={() => onstart(homeText(lang, starter.text))}
        ><span
          class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
          ><Icon icon={starter.icon} size={16} /></span
        ><span class="min-w-0 flex-1 truncate text-sm font-medium"
          >{homeText(lang, starter.label)}</span
        ></button
      >{/each}
  </section>{:else}<div
    data-ask-starters="chips"
    role="group"
    aria-label={homeText(lang, "clearStart")}
    class="flex flex-wrap justify-center gap-2 px-4"
  >
    {#each starters as starter (starter.id)}<Button
        data-ask-starter={starter.id}
        variant="outline"
        size="sm"
        class="rounded-full transition-[background-color,transform] duration-150 active:scale-[0.97] motion-reduce:active:scale-100"
        onclick={() => onstart(homeText(lang, starter.text))}
        ><Icon icon={starter.icon} />{homeText(lang, starter.label)}</Button
      >{/each}
  </div>{/if}
