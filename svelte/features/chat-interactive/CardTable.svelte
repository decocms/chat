<script lang="ts">
  import Dialog from "../../lib/studio/Dialog.svelte";
  import DialogContent from "../../lib/studio/DialogContent.svelte";
  import DialogHeader from "../../lib/studio/DialogHeader.svelte";
  import DialogTitle from "../../lib/studio/DialogTitle.svelte";
  import DialogTrigger from "../../lib/studio/DialogTrigger.svelte";
  import { buttonVariants } from "../../lib/studio/button";
  import Icon from "../../lib/studio/Icon.svelte";
  import { Expand01 } from "../../lib/studio/icons";
  import type { ChatBridge } from "../../chatTypes";
  let {
    headers,
    rows,
    title,
    vb,
    inline = true,
    open = false,
    onOpenChange,
  }: {
    headers: readonly string[];
    rows: readonly (readonly string[])[];
    title: string;
    vb: Pick<ChatBridge, "t">;
    inline?: boolean;
    open?: boolean;
    onOpenChange: (open: boolean) => void;
  } = $props();
</script>

{#snippet table()}
  <div class="tw:max-w-full tw:overflow-x-auto">
    <table
      class="tw:w-full tw:border-collapse tw:font-sans tw:text-sm tw:text-foreground"
    >
      {#if headers.length}<thead
          ><tr
            >{#each headers as header}<th
                class="tw:whitespace-pre-wrap tw:border tw:border-border tw:bg-muted tw:px-3 tw:py-2 tw:text-left tw:font-semibold"
                >{header}</th
              >{/each}</tr
          ></thead
        >{/if}
      <tbody
        >{#each rows as row}<tr
            >{#each row as value}<td
                class="tw:whitespace-pre-wrap tw:border tw:border-border tw:px-3 tw:py-2 tw:align-top"
                >{value}</td
              >{/each}</tr
          >{/each}</tbody
      >
    </table>
  </div>
{/snippet}
<div data-native-card-table class="tw:space-y-2">
  <Dialog {open} {onOpenChange}>
    <DialogTrigger class={buttonVariants({ variant: "outline", size: "sm" })}
      ><Icon icon={Expand01} size={16} />{vb.t(
        "Abrir em tela cheia",
      )}</DialogTrigger
    >
    <DialogContent
      data-vb-native
      class="tw:inset-2 tw:top-2 tw:left-2 tw:flex tw:w-auto tw:max-w-none tw:translate-x-0 tw:translate-y-0 tw:flex-col tw:overflow-auto tw:font-sans tw:text-sm tw:text-foreground tw:min-[901px]:max-w-none"
      closeLabel={vb.t("Fechar")}
      preventScroll={false}
      preventBodyPointerEvents={false}
      preventOverflowTextSelection={false}
    >
      <DialogHeader>
        <DialogTitle class="tw:pr-8 tw:font-sans">{title}</DialogTitle>
      </DialogHeader>
      {@render table()}
    </DialogContent>
  </Dialog>
  {#if inline}{@render table()}{/if}
</div>
