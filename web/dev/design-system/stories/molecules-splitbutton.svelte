<script lang="ts">
  import type { ButtonVariants } from "../../../lib/studio/button";
  import Icon from "../../../lib/studio/Icon.svelte";
  import { GitBranch01 } from "../../../lib/studio/icons";
  import type { SplitButtonMenuItem } from "../../../lib/studio/split-button";
  import SplitButton from "../../../lib/studio/SplitButton.svelte";

  let { story }: { story: string } = $props();

  const noop = () => {};
  const force: SplitButtonMenuItem = {
    key: "force",
    label: "Force publish",
    disabled: true,
    tooltip: "Only maintainers can force publish",
    onSelect: noop,
  };
  const items: SplitButtonMenuItem[] = [
    { key: "review", label: "Request review", onSelect: noop },
    { key: "draft", label: "Convert to draft", onSelect: noop },
    force,
  ];
  const args = {
    label: "Publish to main",
    menuAriaLabel: "More publish options",
    items,
    onclick: noop,
  };

  const VARIANTS: [NonNullable<ButtonVariants["variant"]>, string][] = [
    ["brand", "Publish"],
    ["warning", "Republish"],
    ["outline", "Export"],
    ["default", "Save"],
  ];
  const SIZES: [NonNullable<ButtonVariants["size"]>, string][] = [
    ["xs", "Extra small"],
    ["sm", "Small"],
    ["default", "Default"],
    ["lg", "Large"],
  ];
</script>

{#if story === "default"}
  <SplitButton {...args} />
{:else if story === "without-menu"}
  <SplitButton {...args} items={[]} />
{:else if story === "disabled-primary-with-menu"}
  <SplitButton
    {...args}
    label="Up to date"
    disabled
    tooltip="There is nothing new to publish"
  />
{:else if story === "disabled-menu-item-tooltip"}
  <SplitButton {...args} items={[force]} />
{:else if story === "loading"}
  <SplitButton {...args} label="Publishing" loading />
{:else if story === "pulse"}
  <SplitButton {...args} pulse variant="brand" />
{:else if story === "with-icon"}
  <SplitButton {...args}>
    {#snippet icon()}<Icon icon={GitBranch01} />{/snippet}
  </SplitButton>
{:else if story === "variants"}
  <div class="flex flex-wrap items-center gap-2">
    {#each VARIANTS as [variant, label] (variant)}
      <SplitButton {...args} {variant} {label} />
    {/each}
  </div>
{:else if story === "sizes"}
  <div class="flex flex-wrap items-center gap-2">
    {#each SIZES as [size, label] (size)}
      <SplitButton {...args} {size} {label} />
    {/each}
  </div>
{:else if story === "keyboard-navigation"}
  <div class="space-y-4">
    <div>
      <p class="mb-2 text-sm text-pretty text-muted-foreground">
        Press Tab to focus, Space/Enter to activate
      </p>
      <SplitButton
        {...args}
        label="Click or open menu"
        onclick={() => alert("Primary button clicked")}
      />
    </div>
    <div>
      <p class="mb-2 text-sm text-pretty text-muted-foreground">
        Disabled primary with menu: Tab to menu, arrows navigate, disabled items
        show tooltip
      </p>
      <SplitButton
        {...args}
        label="Out of date"
        disabled
        tooltip="Update required before action"
        onclick={() => alert("Not clickable")}
      />
    </div>
  </div>
{/if}
