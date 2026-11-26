<script lang="ts">
  import Button from "../../lib/studio/Button.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import IconButton from "../../lib/studio/IconButton.svelte";
  import Spinner from "../../lib/studio/Spinner.svelte";
  import TooltipProvider from "../../lib/studio/TooltipProvider.svelte";
  import type { ChatBridge } from "../../app/chatTypes";
  import {
    COMPOSER_BOX,
    COMPOSER_FRAME,
    COMPOSER_ROW,
  } from "../composer/shape";
  /**
   * The bar of selection mode ("Encaminhar"): how many messages are picked, Cancelar, Copiar and Encaminhar. It takes
   * the composer's place while selection mode is on, as in WhatsApp, with the composer's shape: the chat keeps its
   * height, so no message moves under it. Phones: Cancelar is an x and Copiar is its icon, so the count fits. A
   * narrow chat (a pane open) drops the Shift+click hint before it cuts the count.
   * `oncopy` is true when the package is in the clipboard (then selection mode ends and the room says "Copiado");
   * false keeps the bar, with the error in it.
   */
  let {
    count,
    vb,
    oncancel,
    onforward,
    oncopy,
  }: {
    count: number;
    vb: Pick<ChatBridge, "t">;
    oncancel: () => void;
    onforward: () => void;
    oncopy: () => Promise<boolean>;
  } = $props();
  let copying = $state(false),
    failed = $state(false);
  async function copy() {
    if (copying || !count) return;
    copying = true;
    failed = false;
    try {
      failed = !(await oncopy());
    } catch {
      failed = true;
    } finally {
      copying = false;
    }
  }
</script>

<div
  data-forward-bar
  class={["@container shrink-0 font-sans text-sm", COMPOSER_FRAME]}
>
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
    <span
      role="status"
      class={[
        "min-w-0 truncate font-medium md:shrink-0",
        failed && "max-md:hidden",
      ]}
      >{count === 1
        ? vb.t("1 mensagem selecionada")
        : vb.t("{n} mensagens selecionadas", { n: count })}</span
    >
    {#if failed}<span
        role="alert"
        data-forward-copy-error
        class="min-w-0 truncate text-xs text-destructive"
        >{vb.t("Não deu pra copiar. Tente de novo.")}</span
      >{:else}<span
        class="min-w-0 truncate text-xs text-muted-foreground max-md:hidden @max-3xl:hidden"
        >{vb.t("Shift+clique seleciona um intervalo")}</span
      >{/if}
    <span class="ml-auto flex shrink-0 items-center gap-1">
      <Button
        variant="ghost"
        data-forward-cancel
        class="max-md:hidden"
        onclick={oncancel}>{vb.t("Cancelar")}</Button
      >
      <Button
        variant="outline"
        data-forward-copy
        disabled={!count || copying}
        onclick={copy}
        >{#if copying}<Spinner />{:else}<Icon
            icon="copy-01"
            size={16}
          />{/if}<span class="max-md:sr-only">{vb.t("Copiar")}</span></Button
      >
      <Button data-forward-open disabled={!count} onclick={onforward}
        ><Icon icon="share-06" size={16} />{vb.t("Encaminhar")}</Button
      >
    </span>
  </div>
</div>
