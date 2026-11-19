<script lang="ts">
  import Breadcrumb from "../../../lib/studio/Breadcrumb.svelte";
  import BreadcrumbEllipsis from "../../../lib/studio/BreadcrumbEllipsis.svelte";
  import BreadcrumbItem from "../../../lib/studio/BreadcrumbItem.svelte";
  import BreadcrumbLink from "../../../lib/studio/BreadcrumbLink.svelte";
  import BreadcrumbList from "../../../lib/studio/BreadcrumbList.svelte";
  import BreadcrumbPage from "../../../lib/studio/BreadcrumbPage.svelte";
  import BreadcrumbSeparator from "../../../lib/studio/BreadcrumbSeparator.svelte";

  let { story }: { story: string } = $props();
</script>

{#if story === "default"}
  <Breadcrumb>
    <BreadcrumbList>
      <BreadcrumbItem>
        <BreadcrumbLink href="#">Acme Inc</BreadcrumbLink>
      </BreadcrumbItem>
      <BreadcrumbSeparator />
      <BreadcrumbItem>
        <BreadcrumbLink href="#">Projects</BreadcrumbLink>
      </BreadcrumbItem>
      <BreadcrumbSeparator />
      <BreadcrumbItem>
        <BreadcrumbPage>Storefront redesign</BreadcrumbPage>
      </BreadcrumbItem>
    </BreadcrumbList>
  </Breadcrumb>
{:else if story === "with-ellipsis"}
  <Breadcrumb>
    <BreadcrumbList>
      <BreadcrumbItem>
        <BreadcrumbLink href="#">Acme Inc</BreadcrumbLink>
      </BreadcrumbItem>
      <BreadcrumbSeparator />
      <BreadcrumbItem>
        <BreadcrumbEllipsis />
      </BreadcrumbItem>
      <BreadcrumbSeparator />
      <BreadcrumbItem>
        <BreadcrumbLink href="#">Connections</BreadcrumbLink>
      </BreadcrumbItem>
      <BreadcrumbSeparator />
      <BreadcrumbItem>
        <BreadcrumbPage>Slack workspace</BreadcrumbPage>
      </BreadcrumbItem>
    </BreadcrumbList>
  </Breadcrumb>
{:else if story === "truncated"}
  <div class="w-64">
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href="#">Acme Inc</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>
            A very long project name that gets truncated
          </BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  </div>
{/if}
