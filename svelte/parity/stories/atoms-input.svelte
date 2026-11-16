<script lang="ts" module>
  export const layouts = { states: "padded" };
</script>

<script lang="ts">
  import Button from "../../lib/studio/Button.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import { Copy01, SearchMd } from "../../lib/studio/icons";
  import Input from "../../lib/studio/Input.svelte";
  import InputGroup from "../../lib/studio/InputGroup.svelte";
  import InputGroupAddon from "../../lib/studio/InputGroupAddon.svelte";
  import InputGroupInput from "../../lib/studio/InputGroupInput.svelte";
  import Label from "../../lib/studio/Label.svelte";
  import Matrix from "../Matrix.svelte";

  let { story }: { story: string } = $props();

  const SIZE_ROWS = ["default", "sm"] as const;
</script>

{#if story === "default"}
  <Input placeholder="Search connections..." />
{:else if story === "with-label"}
  <div class="tw:grid tw:w-80 tw:gap-2">
    <Label for="project-name">Project name</Label>
    <Input id="project-name" placeholder="my-storefront" />
  </div>
{:else if story === "types"}
  <div class="tw:grid tw:w-80 tw:gap-4">
    <div class="tw:grid tw:gap-2">
      <Label for="email">Email</Label>
      <Input id="email" type="email" placeholder="ana@example.com" />
    </div>
    <div class="tw:grid tw:gap-2">
      <Label for="url">Webhook URL</Label>
      <Input id="url" type="url" placeholder="https://example.com/hooks" />
    </div>
    <div class="tw:grid tw:gap-2">
      <Label for="seats">Seats</Label>
      <Input id="seats" type="number" value={5} min={1} />
    </div>
    <div class="tw:grid tw:gap-2">
      <Label for="avatar">Avatar</Label>
      <Input id="avatar" type="file" />
    </div>
  </div>
{:else if story === "invalid"}
  <div class="tw:grid tw:w-80 tw:gap-2">
    <Label for="slug">Organization slug</Label>
    <Input id="slug" value="Acme Inc!" aria-invalid />
    <p class="tw:text-sm tw:text-pretty tw:text-destructive">
      Slugs can only contain lowercase letters, numbers, and dashes.
    </p>
  </div>
{:else if story === "disabled"}
  <Input placeholder="Search connections..." disabled value="conn_9f2e1c" />
{:else if story === "variants"}
  <div class="tw:grid tw:w-80 tw:gap-3">
    <Input placeholder="Project name" />
    <Input size="sm" placeholder="Project name" />
    <Input value="casa-aurora" data-valid />
    <Input value="Casa Aurora!" aria-invalid />
    <Input value="Read only" readonly />
  </div>
{:else if story === "states"}
  <Matrix
    columns={[
      "Empty",
      "Filled",
      "Hover",
      "Focus",
      "Invalid",
      "Valid",
      "Read only",
      "Disabled",
    ]}
    rows={SIZE_ROWS}
    labels={{ default: "36", sm: "32" }}
  >
    {#snippet cell(size, index)}
      {#if index === 0}
        <Input {size} placeholder="Project name" class="tw:w-44" />
      {:else if index === 1}
        <Input {size} value="Casa Aurora" class="tw:w-44" />
      {:else if index === 2}
        <Input {size} value="Casa Aurora" data-pseudo="hover" class="tw:w-44" />
      {:else if index === 3}
        <Input
          {size}
          value="Casa Aurora"
          data-pseudo="focus-visible"
          class="tw:w-44"
        />
      {:else if index === 4}
        <Input {size} value="Casa Aurora!" aria-invalid class="tw:w-44" />
      {:else if index === 5}
        <Input {size} value="casa-aurora" data-valid class="tw:w-44" />
      {:else if index === 6}
        <Input {size} value="casa-aurora" readonly class="tw:w-44" />
      {:else}
        <Input {size} value="Casa Aurora" disabled class="tw:w-44" />
      {/if}
    {/snippet}
  </Matrix>
{:else if story === "group"}
  <div class="tw:grid tw:w-80 tw:gap-4">
    <InputGroup>
      <InputGroupAddon>
        <Icon icon={SearchMd} />
      </InputGroupAddon>
      <InputGroupInput placeholder="Search connections" />
    </InputGroup>
    <InputGroup>
      <InputGroupAddon>https://</InputGroupAddon>
      <InputGroupInput class="tw:pl-0" value="storefront.com" />
    </InputGroup>
    <InputGroup>
      <InputGroupInput readonly value="sk_live_51Hx…9f2c" />
      <Button
        data-slot="icon-button"
        aria-label="Copy"
        variant="ghost"
        size="icon-sm"
      >
        <Icon icon={Copy01} />
      </Button>
    </InputGroup>
    <InputGroup>
      <InputGroupInput aria-invalid value="not a url" />
    </InputGroup>
  </div>
{/if}
