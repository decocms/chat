<script lang="ts">
  import Button from "../../lib/studio/Button.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import ListRow from "../../lib/studio/ListRow.svelte";
  import type { IconName } from "../../lib/studio/icons";
  import { homeText, type HomeCopyKey, type HomeLanguage } from "./copy";
  /**
   * The Inbox at zero: three ways to start. Each writes the start of an ask
   * into the ask box (you finish it and send). Rows in the desktop list,
   * chips over a phone's docked ask box.
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
    {
      id: "team",
      icon: "users-01",
      label: "starterTeam",
      text: "starterTeamText",
    },
  ];
</script>

{#if layout === "rows"}<section
    data-ask-starters="rows"
    aria-label={homeText(lang, "clearStart")}
    class="flex flex-col gap-1"
  >
    <h2 class="m-0 px-3 pb-1 text-xs font-medium text-muted-foreground">
      {homeText(lang, "clearStart")}
    </h2>
    {#each starters as starter (starter.id)}<ListRow
        data-ask-starter={starter.id}
        title={homeText(lang, starter.label)}
      >
        {#snippet lead()}<Icon icon={starter.icon} />{/snippet}
        {#snippet child({ props, content })}<button
            type="button"
            {...props}
            class="{props.class} border-0 bg-transparent px-3 font-sans text-foreground"
            onclick={() => onstart(homeText(lang, starter.text))}
            >{@render content()}</button
          >{/snippet}
      </ListRow>{/each}
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
        class="rounded-full"
        onclick={() => onstart(homeText(lang, starter.text))}
        ><Icon icon={starter.icon} />{homeText(lang, starter.label)}</Button
      >{/each}
  </div>{/if}
