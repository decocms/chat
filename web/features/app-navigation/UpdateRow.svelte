<script lang="ts">
  import Icon from "../../lib/studio/Icon.svelte";
  /**
   * A new version of the app, at the sidebar's foot over your account: one row you click when you want it, instead
   * of a pill over the chat box (a new version ships every few minutes).
   */
  let {
    lang,
    onreload = () => location.reload(),
  }: { lang: "pt" | "en"; onreload?: () => void } = $props();
  const en = $derived(lang === "en");
</script>

<button
  type="button"
  data-view="update"
  class="group flex w-full min-w-0 cursor-pointer items-center gap-2.5 rounded-xl border-0 bg-brand p-2 text-left font-sans text-brand-foreground transition-[filter,transform] duration-150 hover:brightness-95 focus-visible:outline-2 focus-visible:outline-ring active:scale-[0.98] motion-reduce:active:scale-100"
  onclick={(event) => {
    if (event.currentTarget.isConnected) onreload();
  }}
  ><span
    aria-hidden="true"
    class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-foreground text-brand"
    ><Icon
      icon="refresh-cw-01"
      class="size-4 transition-transform duration-300 group-hover:rotate-180 motion-reduce:transition-none"
    /></span
  ><span class="grid min-w-0 flex-1"
    ><span class="truncate text-sm font-semibold"
      >{en ? "New version" : "Nova versão"}</span
    ><span class="truncate text-xs"
      >{en ? "Click to update" : "Clique pra atualizar"}</span
    ></span
  ></button
>
