<script lang="ts">
  import Spinner from "../studio/Spinner.svelte";
  let { label }: { label: string } = $props();
</script>

<div
  role="status"
  class="inline-flex items-center gap-2 font-sans text-sm text-muted-foreground"
>
  <Spinner size="xs" />{label}
</div>
