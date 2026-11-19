<script lang="ts">
  import type { ComposerProps } from "./types";
  import NativeComposer from "./NativeComposer.svelte";
  let props: ComposerProps = $props();
</script>

{#key props.drafts}{#key `${props.room.me}:${props.room.id}:${props.thread}`}<NativeComposer
      {...props}
    />{/key}{/key}
