<script lang="ts">
  import { onDestroy, untrack, type ComponentProps } from 'svelte';
  import type DocumentApp from './DocumentApp.svelte';
  import { createDeferredModule } from '../deferred-view/module';
  import DeferredViewStatus from '../deferred-view/DeferredViewStatus.svelte';
  let props: ComponentProps<typeof DocumentApp> = $props();
  let active = true;
  const owns = untrack(() => props.current);
  const loader = createDeferredModule(() => import('./DocumentApp.svelte').then(module => module.default), {current: () => active && owns()});
  const view = loader.state;
  loader.ensure();
  onDestroy(() => { active=false; loader.dispose(); });
</script>
{#if $view.component}{@const App = $view.component}<App {...props}/>{:else}<DeferredViewStatus phase={$view.phase} label={props.marker.tool} current={()=>active && owns()} lang={props.props.lang === "en" ? "en" : "pt"} retry={()=>loader.retry()}/>{/if}
