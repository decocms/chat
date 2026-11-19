<script lang="ts">
  import type { Option } from "../../../lib/studio/multi-select";
  import MultiSelect from "../../../lib/studio/MultiSelect.svelte";

  let { story }: { story: string } = $props();

  const projectOptions: Option[] = [
    { label: "Storefront", value: "storefront" },
    { label: "Checkout", value: "checkout" },
    { label: "Internal tools", value: "internal-tools" },
    { label: "Marketing site", value: "marketing-site" },
    { label: "Mobile app", value: "mobile-app" },
    { label: "Data pipeline", value: "data-pipeline" },
  ];

  const roleOptions: Option[] = [
    { label: "Admins", value: "admins", icon: "lock-01" },
    { label: "Members", value: "members", icon: "users-01" },
    { label: "Guests", value: "guests", icon: "globe-01" },
    { label: "Service accounts", value: "service-accounts", icon: "cube-01" },
  ];

  const noop = () => {};
</script>

{#if story === "default"}
  <MultiSelect
    options={projectOptions}
    onValueChange={noop}
    placeholder="Select projects"
  />
{:else if story === "with-selection"}
  <MultiSelect
    options={projectOptions}
    onValueChange={noop}
    placeholder="Select projects"
    defaultValue={["storefront", "checkout"]}
  />
{:else if story === "overflow-badge"}
  <MultiSelect
    options={projectOptions}
    onValueChange={noop}
    placeholder="Select projects"
    defaultValue={["storefront", "checkout", "internal-tools", "mobile-app"]}
    maxCount={2}
  />
{:else if story === "with-icons"}
  <MultiSelect
    options={roleOptions}
    onValueChange={noop}
    defaultValue={["admins", "members"]}
    placeholder="Select roles"
  />
{:else if story === "disabled"}
  <MultiSelect
    options={projectOptions}
    onValueChange={noop}
    placeholder="Select projects"
    defaultValue={["storefront"]}
    disabled
  />
{/if}
