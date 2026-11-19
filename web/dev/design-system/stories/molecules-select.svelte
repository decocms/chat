<script lang="ts" module>
  export const layouts = { states: "padded" };
</script>

<script lang="ts">
  import Label from "../../../lib/studio/Label.svelte";
  import Select from "../../../lib/studio/Select.svelte";
  import SelectContent from "../../../lib/studio/SelectContent.svelte";
  import SelectGroup from "../../../lib/studio/SelectGroup.svelte";
  import SelectItem from "../../../lib/studio/SelectItem.svelte";
  import SelectLabel from "../../../lib/studio/SelectLabel.svelte";
  import SelectSeparator from "../../../lib/studio/SelectSeparator.svelte";
  import SelectTrigger from "../../../lib/studio/SelectTrigger.svelte";
  import SelectValue from "../../../lib/studio/SelectValue.svelte";
  import Matrix from "../Matrix.svelte";

  let { story }: { story: string } = $props();

  const MODES = [
    { value: "off", label: "Off" },
    { value: "manual", label: "On demand" },
    { value: "auto", label: "Always open" },
  ];
  const MODELS = [
    { value: "claude-opus", label: "Claude Opus" },
    { value: "claude-sonnet", label: "Claude Sonnet" },
    { value: "claude-haiku", label: "Claude Haiku" },
    { value: "gpt-5", label: "GPT-5" },
    { value: "gpt-5-mini", label: "GPT-5 mini" },
  ];
  const ENVIRONMENTS = [
    { value: "production", label: "Production" },
    { value: "staging", label: "Staging" },
  ];
  const REGIONS = [{ value: "us-east", label: "US East (managed by plan)" }];
  const PROJECTS = [
    { value: "all", label: "All projects" },
    { value: "site", label: "Site" },
  ];
  const SIZES = ["xs", "sm", "default"] as const;
  const VARIANTS = ["outline", "filled"] as const;
  const STYLE_SIZES = ["default", "sm", "xs"] as const;
  const STATE_ROWS = [
    "outline-default",
    "outline-sm",
    "outline-xs",
    "filled-default",
    "filled-sm",
    "filled-xs",
  ] as const;
  const STATE_LABELS = {
    "outline-default": "outline · 36",
    "outline-sm": "outline · 32",
    "outline-xs": "outline · 28",
    "filled-default": "filled · 36",
    "filled-sm": "filled · 32",
    "filled-xs": "filled · 28",
  };
  const ROW_VARIANT = {
    "outline-default": "outline",
    "outline-sm": "outline",
    "outline-xs": "outline",
    "filled-default": "filled",
    "filled-sm": "filled",
    "filled-xs": "filled",
  } as const;
  const ROW_SIZE = {
    "outline-default": "default",
    "outline-sm": "sm",
    "outline-xs": "xs",
    "filled-default": "default",
    "filled-sm": "sm",
    "filled-xs": "xs",
  } as const;
  const STATES = [undefined, "hover", "focus-visible", undefined, undefined];
</script>

{#if story === "default"}
  <Select>
    <SelectTrigger class="w-56">
      <SelectValue placeholder="Select a role" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="admin" label="Admin">Admin</SelectItem>
      <SelectItem value="member" label="Member">Member</SelectItem>
      <SelectItem value="viewer" label="Viewer">Viewer</SelectItem>
    </SelectContent>
  </Select>
{:else if story === "with-descriptions"}
  <Select value="manual" items={MODES}>
    <SelectTrigger class="w-44">
      <SelectValue />
    </SelectTrigger>
    <SelectContent class="max-w-80">
      <SelectItem
        value="off"
        label="Off"
        description="No CMS button and no Content tab."
      >
        Off
      </SelectItem>
      <SelectItem
        value="manual"
        label="On demand"
        description="Editors open the CMS when they need it."
      >
        On demand
      </SelectItem>
      <SelectItem
        value="auto"
        label="Always open"
        description="The preview opens the CMS as soon as it can edit content."
      >
        Always open
      </SelectItem>
    </SelectContent>
  </Select>
{:else if story === "with-groups"}
  <div class="grid gap-2">
    <Label for="model">Default model</Label>
    <Select value="claude-sonnet" items={MODELS}>
      <SelectTrigger id="model" class="w-64">
        <SelectValue placeholder="Select a model" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Anthropic</SelectLabel>
          <SelectItem value="claude-opus" label="Claude Opus"
            >Claude Opus</SelectItem
          >
          <SelectItem value="claude-sonnet" label="Claude Sonnet"
            >Claude Sonnet</SelectItem
          >
          <SelectItem value="claude-haiku" label="Claude Haiku"
            >Claude Haiku</SelectItem
          >
        </SelectGroup>
        <SelectSeparator />
        <SelectGroup>
          <SelectLabel>OpenAI</SelectLabel>
          <SelectItem value="gpt-5" label="GPT-5">GPT-5</SelectItem>
          <SelectItem value="gpt-5-mini" label="GPT-5 mini"
            >GPT-5 mini</SelectItem
          >
        </SelectGroup>
      </SelectContent>
    </Select>
  </div>
{:else if story === "sizes"}
  <div class="flex items-center gap-2">
    {#each SIZES as size (size)}
      <Select value="production" items={ENVIRONMENTS}>
        <SelectTrigger {size}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="production" label="Production"
            >Production</SelectItem
          >
          <SelectItem value="staging" label="Staging">Staging</SelectItem>
        </SelectContent>
      </Select>
    {/each}
  </div>
{:else if story === "disabled"}
  <Select value="us-east" items={REGIONS} disabled>
    <SelectTrigger class="w-56">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="us-east" label="US East (managed by plan)"
        >US East (managed by plan)</SelectItem
      >
    </SelectContent>
  </Select>
{:else if story === "with-disabled-item"}
  <Select>
    <SelectTrigger class="w-56">
      <SelectValue placeholder="Select a plan" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="free" label="Free">Free</SelectItem>
      <SelectItem value="pro" label="Pro">Pro</SelectItem>
      <SelectItem
        value="enterprise"
        label="Enterprise (contact sales)"
        disabled
      >
        Enterprise (contact sales)
      </SelectItem>
    </SelectContent>
  </Select>
{:else if story === "styles"}
  <div class="flex flex-col gap-2">
    {#each VARIANTS as variant (variant)}
      <div class="flex items-center gap-2">
        {#each STYLE_SIZES as size (size)}
          <Select value="all" items={PROJECTS}>
            <SelectTrigger {variant} {size}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" label="All projects"
                >All projects</SelectItem
              >
              <SelectItem value="site" label="Site">Site</SelectItem>
            </SelectContent>
          </Select>
        {/each}
      </div>
    {/each}
  </div>
{:else if story === "states"}
  <Matrix
    columns={["Default", "Hover", "Focus", "Placeholder", "Disabled"]}
    rows={STATE_ROWS}
    labels={STATE_LABELS}
  >
    {#snippet cell(row, index)}
      <Select
        value={index === 3 ? "" : "all"}
        items={PROJECTS}
        disabled={index === 4}
      >
        <SelectTrigger
          variant={ROW_VARIANT[row]}
          size={ROW_SIZE[row]}
          data-pseudo={STATES[index]}
        >
          <SelectValue placeholder="Pick a project" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all" label="All projects">All projects</SelectItem>
          <SelectItem value="site" label="Site">Site</SelectItem>
        </SelectContent>
      </Select>
    {/snippet}
  </Matrix>
{/if}
