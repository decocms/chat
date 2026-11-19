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
  <div class="max-w-full overflow-x-auto">
    <table class="w-full border-collapse font-sans text-sm text-foreground">
      {#if headers.length}<thead
          ><tr
            >{#each headers as header}<th
                class="whitespace-pre-wrap border border-border bg-muted px-3 py-2 text-left font-semibold"
                >{header}</th
              >{/each}</tr
          ></thead
        >{/if}
      <tbody
        >{#each rows as row}<tr
            >{#each row as value}<td
                class="whitespace-pre-wrap border border-border px-3 py-2 align-top"
                >{value}</td
              >{/each}</tr
          >{/each}</tbody
      >
    </table>
  </div>
{/snippet}
<div data-native-card-table class="space-y-2">
  <Dialog {open} {onOpenChange}>
    <DialogTrigger class={buttonVariants({ variant: "outline", size: "sm" })}
      ><Icon icon={Expand01} size={16} />{vb.t(
        "Abrir em tela cheia",
      )}</DialogTrigger
    >
    <DialogContent
      class="inset-2 top-2 left-2 flex w-auto max-w-none translate-x-0 translate-y-0 flex-col overflow-auto font-sans text-sm text-foreground md:max-w-none"
      closeLabel={vb.t("Fechar")}
      preventScroll={false}
      preventBodyPointerEvents={false}
      preventOverflowTextSelection={false}
    >
      <DialogHeader>
        <DialogTitle class="pr-8 font-sans">{title}</DialogTitle>
      </DialogHeader>
      {@render table()}
    </DialogContent>
  </Dialog>
  {#if inline}{@render table()}{/if}
</div>
