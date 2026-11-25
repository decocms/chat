<script lang="ts">
  import Skeleton from "../../lib/studio/Skeleton.svelte";
  import { COMPOSER_BOX, COMPOSER_ROW } from "../composer/shape";
  // The home's one loading state: the headline and the ask box as bars. The
  // shell draws it with `page` while the home's own module loads (an empty
  // square where the cube goes), and the home keeps the same bars until your
  // account answers, so nothing moves between the two.
  // A phone gets the list's bar instead (`chats`, or `page` on a phone): the
  // title ("Conversas" / "Chats") on the left and you, so the title does not
  // start centred and then jump left (Gimenes #3878, #4144).
  let {
    label,
    title,
    page = false,
    chats = false,
  }: {
    label: string;
    title: string;
    page?: boolean;
    chats?: boolean;
  } = $props();
</script>

{#snippet bars()}<div role="status" aria-label={label}>
    <Skeleton class="mt-3 h-9 w-80 max-w-[70vw]" />
    <!-- The ask box is a ChatField: its shape comes from composer/shape.ts. -->
    <div
      class={[
        "mx-auto mt-7 w-[576px] max-w-[85vw]",
        COMPOSER_BOX,
        COMPOSER_ROW,
      ]}
    ></div>
  </div>{/snippet}

<!-- HomePanel's phone list: the same bar, search field and rows, as bars. -->
{#snippet list(only: string)}<main
    aria-busy="true"
    data-home-layout="chats"
    data-home-skeleton
    class={[
      "min-h-full bg-background px-2 pb-28 font-sans text-sm leading-6 text-foreground",
      only,
    ]}
  >
    <div role="status" aria-label={label}>
      <div class="-mx-2 flex h-14 items-center gap-1 pr-3 pl-4">
        <span
          class="m-0 min-w-0 flex-1 truncate text-2xl font-bold tracking-tight"
          >{title}</span
        >
        <span
          aria-hidden="true"
          class="grid size-10 shrink-0 place-items-center"
          ><Skeleton class="size-8 rounded-full" /></span
        >
      </div>
      <div class="px-2 pt-1 pb-3">
        <Skeleton class="h-11 w-full rounded-full" />
      </div>
      <div class="space-y-0.5">
        {#each ["h-3.5 w-36", "h-3.5 w-28", "h-3.5 w-40", "h-3.5 w-24", "h-3.5 w-32"] as name (name)}<div
            class="flex items-center gap-3 px-2 py-2"
          >
            <Skeleton class="size-10 shrink-0 rounded-xl" />
            <div class="flex min-w-0 flex-1 flex-col gap-2">
              <Skeleton class={name} />
              <Skeleton class="h-3 w-48 max-w-full" />
            </div>
          </div>{/each}
      </div>
    </div>
  </main>{/snippet}

{#if chats}{@render list("")}{:else if page}{@render list("md:hidden")}
  <main
    aria-busy="true"
    class="relative min-h-full bg-background font-sans text-sm leading-6 text-foreground max-md:hidden"
  >
    <div class="flex flex-col items-center px-4 pt-4 md:px-8">
      <section class="mt-[10vh] flex flex-col items-center max-md:mt-4">
        <div aria-hidden="true" class="size-[200px] max-md:size-[112px]"></div>
        {@render bars()}
      </section>
    </div>
  </main>{:else}{@render bars()}{/if}
