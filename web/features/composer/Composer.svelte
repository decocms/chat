<script lang="ts">
  import type { ComposerProps } from "./types";
  import ComposerForm from "./ComposerForm.svelte";
  let props: ComposerProps = $props();
</script>

{#key props.drafts}{#key `${props.room.me}:${props.room.id}:${props.thread}`}<ComposerForm
      {...props}
    />{/key}{/key}
