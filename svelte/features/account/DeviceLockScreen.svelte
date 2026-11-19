<script lang="ts">
  import { Dialog } from "bits-ui";
  import { untrack } from "svelte";
  import Button from "../../lib/studio/Button.svelte";
  import type { DeviceLock } from "./device";
  let { owner, lang }: { owner: DeviceLock; lang: string } = $props();
  const view = untrack(() => owner.state);
  const en = $derived(lang === "en");
  let button: HTMLElement | null = $state(null);
</script>

<Dialog.Root open={$view.locked}>
  <Dialog.Portal>
    <Dialog.Content
      data-device-lock
      onEscapeKeydown={(event) => event.preventDefault()}
      onInteractOutside={(event) => event.preventDefault()}
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        button?.focus();
      }}
      class="fixed inset-0 z-[9999] m-0 grid place-content-center justify-items-center gap-4 bg-background p-6 font-sans text-foreground outline-none"
    >
      <img
        src="/favicon.svg"
        width="64"
        height="64"
        alt=""
        class="rounded-control"
      />
      <Dialog.Title class="m-0 font-sans text-2xl font-semibold"
        >deco.chat</Dialog.Title
      >
      <Dialog.Description class="text-sm text-muted-foreground"
        >{en
          ? "Unlock this device to continue."
          : "Desbloqueie este aparelho para continuar."}</Dialog.Description
      >
      <Button
        bind:ref={button}
        disabled={$view.busy || !$view.supported}
        onclick={(event) => {
          if (event.currentTarget.isConnected) void owner.unlock();
        }}>{en ? "Unlock with Face ID" : "Desbloquear com Face ID"}</Button
      >
      {#if !$view.supported}<p role="alert" class="text-sm text-destructive">
          {en
            ? "Device authentication is unavailable in this browser."
            : "A autenticação do aparelho não está disponível neste navegador."}
        </p>{/if}
      {#if $view.error}<p role="alert" class="text-sm text-destructive">
          {en
            ? "Could not unlock. Tap to try again."
            : "Não deu para desbloquear. Toque para tentar de novo."}
        </p>{/if}
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
