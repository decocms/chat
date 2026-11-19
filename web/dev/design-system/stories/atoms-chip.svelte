<script lang="ts" module>
  export const layouts = { states: "padded" };
</script>

<script lang="ts">
  import Chip from "../../../lib/studio/Chip.svelte";
  import ChipMeta from "../../../lib/studio/ChipMeta.svelte";
  import Icon from "../../../lib/studio/Icon.svelte";
  import { Globe02, Target04 } from "../../../lib/studio/icons";
  import ProjectIcon from "../../../lib/studio/ProjectIcon.svelte";
  import Matrix from "../Matrix.svelte";

  let { story }: { story: string } = $props();

  const ROWS = ["sm", "lg"] as const;
  const STATES = [undefined, "hover", "focus-visible"];
</script>

<!-- Studio's root line height, which the parity page does not inherit. -->
<div class="leading-[1.5]">
  {#if story === "playground"}
    <Chip size="sm">
      {#snippet child({ props })}
        <button type="button" {...props}>Mobile conversion</button>
      {/snippet}
    </Chip>
  {:else if story === "states"}
    <Matrix
      columns={["Default", "Hover", "Focus"]}
      proposed={["Hover", "Focus"]}
      rows={ROWS}
      labels={{ sm: "sm · goal", lg: "lg · app" }}
    >
      {#snippet cell(size, index)}
        <Chip {size}>
          {#snippet child({ props })}
            <button type="button" data-pseudo={STATES[index]} {...props}>
              {#if size === "sm"}
                <Icon icon={Target04} /> Mobile conversion
              {:else}
                <ProjectIcon color="blue" class="size-[1.625rem] rounded-full">
                  <Icon icon={Globe02} class="size-3.5" />
                </ProjectIcon>
                Site Editor <ChipMeta>Site</ChipMeta>
              {/if}
            </button>
          {/snippet}
        </Chip>
      {/snippet}
    </Matrix>
  {/if}
</div>
