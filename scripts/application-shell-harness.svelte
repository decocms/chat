<script lang="ts">
  import AppShell from "../web/features/application/AppShell.svelte";
  import type { BrowserApplicationServices } from "../web/features/application/browser";
  import type { ApplicationShellEffects } from "../web/features/application/shellTypes";
  import Button from "../web/lib/studio/Button.svelte";
  let {
    services,
    effects,
  }: {
    services: BrowserApplicationServices;
    effects: ApplicationShellEffects;
  } = $props();
</script>

<AppShell {services} {effects}>
  {#snippet roomSnippet(presentation)}
    <section data-test-room-snippet>
      <p>Controlled room presentation fixture</p>
      <Button onclick={() => presentation.openInbox()}
        >Open fixture inbox</Button
      >
    </section>
  {/snippet}
</AppShell>
