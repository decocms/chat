<script lang="ts">
  import Button from "../../lib/studio/Button.svelte";
  import PaneLoading from "../../lib/components/PaneLoading.svelte";
  let {
    phase,
    lang,
    label,
    retry,
    current,
  }: {
    phase: "idle" | "loading" | "error" | "ready";
    lang: "en" | "pt";
    label: string;
    retry(): void;
    current(): boolean;
  } = $props();
</script>

{#if phase === "error"}<section
    data-deferred-view
    aria-label={label}
    class="space-y-3 p-4 font-sans text-sm text-foreground"
  >
    <p role="alert">
      {lang === "en"
        ? "Could not load this view. Retry, or reload the page if it still fails."
        : "Não foi possível carregar esta tela. Tente de novo ou recarregue a página se o erro continuar."}
    </p>
    <Button
      variant="outline"
      onclick={(event) => {
        if (event.currentTarget.isConnected && current()) retry();
      }}>{lang === "en" ? "Retry" : "Tentar de novo"}</Button
    >
  </section>{:else}<section
    data-deferred-view
    aria-label={label}
    aria-busy="true"
    class="flex h-full flex-col"
  >
    <PaneLoading label={lang === "en" ? "Loading…" : "Carregando…"} />
  </section>{/if}
