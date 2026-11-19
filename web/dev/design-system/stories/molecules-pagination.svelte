<script lang="ts">
  import Pagination from "../../../lib/studio/Pagination.svelte";
  import PaginationContent from "../../../lib/studio/PaginationContent.svelte";
  import PaginationEllipsis from "../../../lib/studio/PaginationEllipsis.svelte";
  import PaginationItem from "../../../lib/studio/PaginationItem.svelte";
  import PaginationLink from "../../../lib/studio/PaginationLink.svelte";
  import PaginationNext from "../../../lib/studio/PaginationNext.svelte";
  import PaginationPrevious from "../../../lib/studio/PaginationPrevious.svelte";

  let { story }: { story: string } = $props();
</script>

{#if story === "default"}
  <Pagination>
    <PaginationContent>
      <PaginationItem><PaginationPrevious href="#" /></PaginationItem>
      <PaginationItem
        ><PaginationLink href="#">1</PaginationLink></PaginationItem
      >
      <PaginationItem>
        <PaginationLink href="#" isActive>2</PaginationLink>
      </PaginationItem>
      <PaginationItem
        ><PaginationLink href="#">3</PaginationLink></PaginationItem
      >
      <PaginationItem><PaginationNext href="#" /></PaginationItem>
    </PaginationContent>
  </Pagination>
{:else if story === "with-ellipsis"}
  <Pagination>
    <PaginationContent>
      <PaginationItem><PaginationPrevious href="#" /></PaginationItem>
      <PaginationItem
        ><PaginationLink href="#">1</PaginationLink></PaginationItem
      >
      <PaginationItem><PaginationEllipsis /></PaginationItem>
      <PaginationItem
        ><PaginationLink href="#">7</PaginationLink></PaginationItem
      >
      <PaginationItem>
        <PaginationLink href="#" isActive>8</PaginationLink>
      </PaginationItem>
      <PaginationItem
        ><PaginationLink href="#">9</PaginationLink></PaginationItem
      >
      <PaginationItem><PaginationEllipsis /></PaginationItem>
      <PaginationItem
        ><PaginationLink href="#">24</PaginationLink></PaginationItem
      >
      <PaginationItem><PaginationNext href="#" /></PaginationItem>
    </PaginationContent>
  </Pagination>
{/if}
