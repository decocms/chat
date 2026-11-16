<script lang="ts">
  import Spinner from "../studio/Spinner.svelte";
  let { label }: { label: string } = $props();
</script>

<div
  role="status"
  class="tw:inline-flex tw:items-center tw:gap-2 tw:font-sans tw:text-sm tw:text-muted-foreground"
>
  <Spinner size="xs" />{label}
</div>
