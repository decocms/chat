<script lang="ts">
  import AppShell from "../web/features/application/AppShell.svelte";
  import type { BrowserApplicationServices } from "../web/features/application/browser";
  import type { ApplicationShellEffects } from "../web/features/application/shellTypes";
  import { createComposerDrafts } from "../web/features/composer/drafts";
  let {
    services,
    effects,
  }: {
    services: BrowserApplicationServices;
    effects: ApplicationShellEffects;
  } = $props();
  const drafts = createComposerDrafts();
</script>

<AppShell {services} {effects} {drafts}>
  {#snippet roomSnippet()}
    <section data-test-room-snippet>
      <p>Controlled room presentation fixture</p>
    </section>
  {/snippet}
</AppShell>
