<script lang="ts" module>
  export const layouts = { projects: "padded" };
</script>

<script lang="ts">
  import Icon from "../../../lib/studio/Icon.svelte";
  import {
    BookOpen01,
    Globe02,
    LayoutAlt01,
    Phone01,
  } from "../../../lib/studio/icons";
  import ProjectIcon from "../../../lib/studio/ProjectIcon.svelte";
  import Matrix from "../Matrix.svelte";

  let { story }: { story: string } = $props();

  const PROJECTS = {
    Site: { color: "blue", icon: Globe02 },
    "Sales app": { color: "green", icon: Phone01 },
    Blog: { color: "purple", icon: BookOpen01 },
    "Landing pages": { color: "red", icon: LayoutAlt01 },
  } as const;
  const ROWS = ["Site", "Sales app", "Blog", "Landing pages"] as const;
</script>

<!-- Studio's root line height, which the parity page does not inherit. -->
<div class="leading-[1.5]">
  {#if story === "playground"}
    <ProjectIcon color="blue" size="default"
      ><Icon icon={Globe02} /></ProjectIcon
    >
  {:else if story === "projects"}
    <Matrix columns={["20 · nav, chips", "28 · rails, cards"]} rows={ROWS}>
      {#snippet cell(name, index)}
        <ProjectIcon
          color={PROJECTS[name].color}
          size={index === 0 ? "sm" : undefined}
          ><Icon icon={PROJECTS[name].icon} /></ProjectIcon
        >
      {/snippet}
    </Matrix>
  {/if}
</div>
