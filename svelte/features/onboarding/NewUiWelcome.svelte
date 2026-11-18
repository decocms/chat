<script lang="ts">
  // Shown once per device to people who used vibebook before Svelte became the default (Nov 2026): what changed and
  // how to go back. A brand-new account (no name yet, the onboarding asks for it) never sees it: the flag is set
  // quietly instead, so "the old app" never comes up for someone who never had it.
  import { onMount } from "svelte";
  import Dialog from "../../lib/studio/Dialog.svelte";
  import DialogContent from "../../lib/studio/DialogContent.svelte";
  import DialogHeader from "../../lib/studio/DialogHeader.svelte";
  import DialogTitle from "../../lib/studio/DialogTitle.svelte";
  import DialogDescription from "../../lib/studio/DialogDescription.svelte";
  import DialogFooter from "../../lib/studio/DialogFooter.svelte";
  import Button from "../../lib/studio/Button.svelte";
  import { stored, store } from "../pwa/platform";
  import { uiSwitchUrl } from "../../../shared/uiVariant";

  const KEY = "vb.newUiWelcomed";
  let { returning, lang }: { returning: boolean; lang: "pt" | "en" } = $props();
  let open = $state(false);
  const en = $derived(lang === "en");

  onMount(() => {
    if (stored(KEY)) return;
    // Nothing to remember on this device (private window): don't nag on every page load either.
    if (!store(KEY, true)) return;
    open = returning;
  });
</script>

{#if open}<Dialog
    open
    onOpenChange={(next) => {
      if (!next) open = false;
    }}
  >
    <DialogContent
      data-vb-native
      data-new-ui-welcome
      class="font-sans text-sm text-foreground md:max-w-md"
      closeLabel={en ? "Close" : "Fechar"}
    >
      <DialogHeader>
        <DialogTitle class="pr-8 font-sans"
          >{en
            ? "Welcome to the new vibebook"
            : "Bem-vindo ao vibebook novo"}</DialogTitle
        >
        <DialogDescription
          >{en
            ? "vibebook has a new look. Your rooms, conversations, docs and tasks are all here, just as you left them."
            : "O vibebook está de cara nova. Suas salas, conversas, docs e tarefas estão todos aqui, do jeito que você deixou."}</DialogDescription
        >
      </DialogHeader>
      <p class="text-muted-foreground">
        {en
          ? "Prefer the previous version? Turn off New UI in Settings (click yourself at the foot of the sidebar) to go back on this device. You can switch again any time."
          : "Prefere a versão anterior? Desligue Nova UI nas Configurações (clique em você, no pé da barra lateral) para voltar neste aparelho. Dá pra trocar de novo quando quiser."}
      </p>
      <DialogFooter>
        <Button
          variant="ghost"
          data-new-ui-welcome-back
          onclick={() =>
            window.location.assign(
              uiSwitchUrl("vanilla", window.location.href),
            )}
          >{en ? "Use the previous version" : "Usar a versão anterior"}</Button
        >
        <Button data-new-ui-welcome-ok onclick={() => (open = false)}
          >{en ? "Got it" : "Entendi"}</Button
        >
      </DialogFooter>
    </DialogContent>
  </Dialog>{/if}
