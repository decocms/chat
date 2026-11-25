<script lang="ts">
  import Button from "../../lib/studio/Button.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import IconButton from "../../lib/studio/IconButton.svelte";
  import TooltipProvider from "../../lib/studio/TooltipProvider.svelte";
  import type { ChatBridge } from "../../app/chatTypes";
  import {
    COMPOSER_BOX,
    COMPOSER_FRAME,
    COMPOSER_ROW,
  } from "../composer/shape";
  /**
   * The bar of selection mode ("Encaminhar"): how many messages are picked, Cancelar and Encaminhar. It takes the
   * composer's place while selection mode is on, as in WhatsApp, with the composer's shape: the chat keeps its height,
   * so no message moves under it. Phones: Cancelar is an x, so the count fits.
   */
  let {
    count,
    vb,
    oncancel,
    onforward,
  }: {
    count: number;
    vb: Pick<ChatBridge, "t">;
    oncancel: () => void;
    onforward: () => void;
  } = $props();
</script>

<div data-forward-bar class={["shrink-0 font-sans text-sm", COMPOSER_FRAME]}>
  <div
    role="toolbar"
    aria-label={vb.t("Encaminhar mensagens")}
    class={[
      "flex items-center gap-2 pr-3 pl-4 text-foreground max-md:pl-1.5 animate-in [--tw-enter-opacity:0] duration-150 motion-reduce:animate-none",
      COMPOSER_BOX,
      COMPOSER_ROW,
    ]}
  >
    <TooltipProvider>
      <IconButton
        label={vb.t("Cancelar")}
        data-forward-cancel
        class="md:hidden"
        onclick={oncancel}><Icon icon="x" size={16} /></IconButton
      >
    </TooltipProvider>
    <span role="status" class="min-w-0 truncate font-medium"
      >{count === 1
        ? vb.t("1 mensagem selecionada")
        : vb.t("{n} mensagens selecionadas", { n: count })}</span
    >
    <span class="min-w-0 truncate text-xs text-muted-foreground max-md:hidden"
      >{vb.t("Shift+clique seleciona um intervalo")}</span
    >
    <span class="ml-auto flex shrink-0 items-center gap-1">
      <Button
        variant="ghost"
        data-forward-cancel
        class="max-md:hidden"
        onclick={oncancel}>{vb.t("Cancelar")}</Button
      >
      <Button data-forward-open disabled={!count} onclick={onforward}
        ><Icon icon="share-06" size={16} />{vb.t("Encaminhar")}</Button
      >
    </span>
  </div>
</div>
