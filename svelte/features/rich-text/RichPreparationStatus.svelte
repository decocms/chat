<script lang="ts">
  let {
    phase,
    retry,
    lang = "en",
  }: {
    phase: "loading" | "error" | "cancelled";
    retry(): void;
    lang?: string;
  } = $props();
</script>

{#if phase === "loading"}<p
    role="status"
    data-rich-loading
    class="tw:my-2 tw:text-sm tw:text-muted-foreground"
  >
    {lang === "en" ? "Loading content…" : "Carregando conteúdo…"}
  </p>
{:else if phase === "error"}<div
    role="status"
    data-rich-error
    class="tw:my-2 tw:text-sm tw:text-muted-foreground"
  >
    <p>
      {lang === "en"
        ? "Content could not be loaded."
        : "Não foi possível carregar o conteúdo."}
    </p>
    <button
      type="button"
      onclick={retry}
      class="tw:rounded-control tw:border tw:border-border tw:px-2 tw:py-1 tw:text-foreground tw:focus-visible:outline-2 tw:focus-visible:outline-ring"
      >{lang === "en" ? "Retry" : "Tentar novamente"}</button
    >
  </div>{/if}
