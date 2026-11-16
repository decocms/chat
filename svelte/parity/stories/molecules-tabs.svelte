<script lang="ts" module>
  export const layouts = { states: "padded" };
</script>

<script lang="ts">
  import Icon from "../../lib/studio/Icon.svelte";
  import { File02, Settings01 } from "../../lib/studio/icons";
  import Tabs from "../../lib/studio/Tabs.svelte";
  import TabsContent from "../../lib/studio/TabsContent.svelte";
  import TabsList from "../../lib/studio/TabsList.svelte";
  import TabsTrigger from "../../lib/studio/TabsTrigger.svelte";
  import Matrix from "../Matrix.svelte";

  let { story }: { story: string } = $props();

  const STATES = [undefined, "hover", "focus-visible"];
</script>

{#if story === "default"}
  <Tabs value="general" class="tw:w-96">
    <TabsList class="tw:w-full">
      <TabsTrigger value="general">General</TabsTrigger>
      <TabsTrigger value="members">Members</TabsTrigger>
      <TabsTrigger value="billing">Billing</TabsTrigger>
    </TabsList>
    <TabsContent value="general" class="tw:text-sm tw:text-muted-foreground">
      Update your organization name, logo, and default preferences.
    </TabsContent>
    <TabsContent value="members" class="tw:text-sm tw:text-muted-foreground">
      Invite teammates and manage their roles.
    </TabsContent>
    <TabsContent value="billing" class="tw:text-sm tw:text-muted-foreground">
      View invoices and change your plan.
    </TabsContent>
  </Tabs>
{:else if story === "underline"}
  <Tabs value="overview" variant="underline" class="tw:w-96">
    <TabsList variant="underline">
      <TabsTrigger variant="underline" value="overview">Overview</TabsTrigger>
      <TabsTrigger variant="underline" value="activity">Activity</TabsTrigger>
      <TabsTrigger variant="underline" value="settings">Settings</TabsTrigger>
    </TabsList>
    <TabsContent value="overview" class="tw:text-sm tw:text-muted-foreground">
      Recent activity and usage for this connection.
    </TabsContent>
    <TabsContent value="activity" class="tw:text-sm tw:text-muted-foreground">
      Tool calls made through this connection in the last 30 days.
    </TabsContent>
    <TabsContent value="settings" class="tw:text-sm tw:text-muted-foreground">
      Configure authentication and access policies.
    </TabsContent>
  </Tabs>
{:else if story === "canvas"}
  <Tabs value="readme" variant="canvas" class="tw:w-96">
    <TabsList variant="canvas" class="tw:w-full">
      <TabsTrigger variant="canvas" value="readme">
        <Icon icon={File02} class="tw:size-4" /> README.md
      </TabsTrigger>
      <TabsTrigger variant="canvas" value="config">
        <Icon icon={Settings01} class="tw:size-4" /> config.json
      </TabsTrigger>
    </TabsList>
    <TabsContent
      value="readme"
      class="tw:p-4 tw:text-sm tw:text-muted-foreground"
    >
      Getting started guide for the project.
    </TabsContent>
    <TabsContent
      value="config"
      class="tw:p-4 tw:text-sm tw:text-muted-foreground"
    >
      Runtime configuration for the MCP server.
    </TabsContent>
  </Tabs>
{:else if story === "disabled"}
  <Tabs value="general" class="tw:w-96">
    <TabsList class="tw:w-full">
      <TabsTrigger value="general">General</TabsTrigger>
      <TabsTrigger value="advanced" disabled>Advanced</TabsTrigger>
    </TabsList>
    <TabsContent value="general" class="tw:text-sm tw:text-muted-foreground">
      Advanced settings require an admin role.
    </TabsContent>
  </Tabs>
{:else if story === "states"}
  <Matrix
    columns={["Default", "Hover on Code", "Focus on Code"]}
    rows={["Tabs"] as const}
  >
    {#snippet cell(_row, index)}
      <Tabs value="preview">
        <TabsList>
          <TabsTrigger value="preview">Preview</TabsTrigger>
          <TabsTrigger value="code" data-pseudo={STATES[index]}
            >Code</TabsTrigger
          >
          <TabsTrigger value="content">Content</TabsTrigger>
        </TabsList>
      </Tabs>
    {/snippet}
  </Matrix>
{/if}
