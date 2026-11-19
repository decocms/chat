<script lang="ts">
  import type { Snippet } from "svelte";
  import Card from "../../lib/studio/Card.svelte";
  let { title, children }: { title: string; children: Snippet } = $props();
</script>

<svelte:head><title>{title} · deco.chat</title></svelte:head>
<main
  data-view="auth"
  class="flex min-h-dvh items-center justify-center bg-background p-4 font-sans text-sm leading-6 text-foreground"
>
  <div class="w-full max-w-md">
    <!-- A flex gap, not space-y: the children set m-0, and in Tailwind v4 that wins over space-y, so space-y gave no space. -->
    <Card class="flex flex-col gap-6 p-6 md:p-8">
      <a
        href="/"
        class="inline-flex self-start items-center gap-2 rounded-control text-lg font-semibold text-foreground no-underline focus-visible:outline-2 focus-visible:outline-ring"
        ><img
          src="/favicon.svg"
          alt=""
          width="32"
          height="32"
          class="size-8 rounded-lg"
        />deco.chat</a
      >
      <h1
        class="m-0 break-words text-2xl font-semibold leading-8 tracking-tight"
      >
        {title}
      </h1>
      {@render children()}
    </Card>
  </div>
</main>
