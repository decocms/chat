<script lang="ts">
  import { untrack } from "svelte";
  import Skeleton from "../../lib/studio/Skeleton.svelte";
  import IconButton from "../../lib/studio/IconButton.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import { ArrowLeft } from "../../lib/studio/icons";
  import RoomMark from "../room-sidebar/RoomMark.svelte";
  import { roomIcon } from "../home/model";
  import { roomDocumentWidth } from "../room-layout/preview";
  import type { BrowserApplicationServices } from "../application/browser";
  /** A room that is still connecting, drawn in the room's own frame (the cells of
   * RoomLayoutFrame: sidebar, chat with its header and composer, the doc on the
   * right) with the name and icon the home already knows, so nothing moves when
   * the state lands. */
  let {
    roomId,
    services,
    onhome,
  }: {
    roomId: string | null;
    services: BrowserApplicationServices;
    onhome(event: MouseEvent): void;
  } = $props();
  const personal = untrack(() => services.personal.state);
  const room = $derived(
    roomId ? $personal.me?.books.find((book) => book.id === roomId) : undefined,
  );
  const title = $derived(room?.title ?? "");
  const icon = $derived(room ? roomIcon(room) : undefined);
  const t = (text: string) => services.t(text);
</script>

{#snippet mark(size: string)}
  {#if title}<RoomMark {title} src={icon} class={size} />{:else}<Skeleton
      class={["tw:shrink-0 tw:rounded-md", size].join(" ")}
    />{/if}
{/snippet}

{#snippet line(width: string, height = "tw:h-3")}
  <Skeleton class={[height, width, "tw:rounded-full"].join(" ")} />
{/snippet}

<div
  data-vb-native
  data-room-skeleton
  class="tw:grid tw:h-full tw:min-h-0 tw:w-full tw:min-w-0 tw:grid-cols-[minmax(0,1fr)] tw:overflow-hidden tw:bg-background tw:font-sans tw:text-sm tw:text-foreground tw:[container-type:inline-size] tw:min-[901px]:grid-cols-[auto_minmax(0,1fr)_auto] tw:min-[901px]:bg-sidebar"
>
  <!-- Sidebar: the room's own row, the epic tabs and rows, People at the bottom. -->
  <aside
    aria-hidden="true"
    class="tw:hidden tw:w-room-sidebar tw:min-h-0 tw:flex-col tw:gap-6 tw:p-2 tw:text-sidebar-foreground tw:min-[901px]:flex"
  >
    <div class="tw:flex tw:flex-col tw:gap-3">
      <div
        class="tw:flex tw:h-9 tw:min-w-0 tw:items-center tw:gap-2 tw:rounded-lg tw:bg-sidebar-accent tw:px-2 tw:font-medium"
      >
        {@render mark("tw:size-6")}
        {#if title}<span class="tw:min-w-0 tw:flex-1 tw:truncate">{title}</span
          >{:else}{@render line("tw:w-32")}{/if}
      </div>
      <Skeleton class="tw:h-9 tw:w-full tw:rounded-lg tw:opacity-60" />
      {#each ["tw:w-3/5", "tw:w-2/5", "tw:w-1/2"] as width (width)}
        <div class="tw:flex tw:h-9 tw:items-center tw:gap-2 tw:px-2">
          <Skeleton class="tw:size-5 tw:shrink-0 tw:rounded-full" />
          {@render line(width, "tw:h-2.5")}
        </div>
      {/each}
    </div>
    <div class="tw:flex tw:flex-col tw:gap-3 tw:px-2">
      {@render line("tw:w-14", "tw:h-2.5")}
      <Skeleton class="tw:h-8 tw:w-full tw:rounded-lg tw:opacity-60" />
    </div>
    <div class="tw:mt-auto tw:flex tw:flex-col tw:gap-3 tw:px-2 tw:pb-1">
      {@render line("tw:w-24", "tw:h-2.5")}
      <div class="tw:flex tw:items-center tw:gap-2">
        <Skeleton class="tw:size-6 tw:shrink-0 tw:rounded-full" />
        {@render line("tw:w-20", "tw:h-2.5")}
      </div>
    </div>
  </aside>

  <!-- Chat: header with the room's icon and name, the messages, the composer. -->
  <main
    class="tw:flex tw:min-h-0 tw:min-w-0 tw:flex-col tw:bg-background tw:min-[901px]:my-2 tw:min-[901px]:mr-2 tw:min-[901px]:rounded-surface tw:min-[901px]:shadow-edge"
  >
    <header
      class="tw:flex tw:min-w-0 tw:shrink-0 tw:items-center tw:gap-1 tw:px-4 tw:pt-[max(0.75rem,env(safe-area-inset-top))] tw:pb-3 tw:min-[901px]:h-[52px] tw:min-[901px]:border-b tw:min-[901px]:border-border tw:min-[901px]:pt-0 tw:min-[901px]:pr-3 tw:min-[901px]:pb-0 tw:min-[901px]:pl-5"
    >
      <IconButton
        label={t("Seus vibebooks")}
        size="icon"
        class="tw:rounded-full tw:min-[901px]:hidden"
        onclick={onhome}><Icon icon={ArrowLeft} size={16} /></IconButton
      >
      <span class="tw:hidden tw:min-[901px]:contents"
        >{@render mark("tw:size-6")}</span
      >
      {#if title}<h2
          class="tw:m-0 tw:flex tw:min-w-0 tw:flex-1 tw:items-center tw:px-2 tw:text-sm tw:font-medium"
        >
          <span class="tw:truncate">{title}</span>
        </h2>{:else}<div
          aria-hidden="true"
          class="tw:flex tw:min-w-0 tw:flex-1 tw:items-center tw:px-2"
        >
          {@render line("tw:w-40")}
        </div>{/if}
      <div
        aria-hidden="true"
        class="tw:flex tw:shrink-0 tw:items-center tw:gap-1"
      >
        {#each [0, 1, 2, 3] as slot (slot)}
          <span class="tw:grid tw:size-8 tw:place-items-center"
            ><Skeleton class="tw:size-4 tw:rounded-full" /></span
          >
        {/each}
      </div>
    </header>
    <!-- Phones: the doc's tab bar sits right under the header. -->
    <div
      aria-hidden="true"
      class="tw:flex tw:h-[46px] tw:shrink-0 tw:items-center tw:gap-0.5 tw:border-b tw:border-border tw:px-2 tw:min-[901px]:hidden"
    >
      <Skeleton class="tw:h-7 tw:flex-1 tw:rounded-full" />
      {#each [0, 1, 2, 3, 4] as slot (slot)}
        <span class="tw:grid tw:h-7 tw:w-8 tw:place-items-center"
          ><Skeleton class="tw:size-4 tw:rounded-full" /></span
        >
      {/each}
    </div>

    <div
      class="tw:flex tw:min-h-0 tw:flex-1 tw:flex-col tw:overflow-hidden tw:px-4 tw:min-[901px]:px-6"
    >
      <div
        class="tw:flex tw:flex-1 tw:flex-col tw:items-center tw:justify-center tw:gap-3 tw:py-8 tw:text-center"
      >
        {@render mark("tw:size-12 tw:rounded-xl")}
        {#if title}<p
            class="tw:m-0 tw:max-w-full tw:truncate tw:text-base tw:font-semibold"
          >
            {title}
          </p>{/if}
        <p
          role="status"
          class="tw:m-0 tw:text-muted-foreground tw:motion-safe:animate-pulse"
        >
          {t("Carregando…")}
        </p>
      </div>
      <div aria-hidden="true" class="tw:flex tw:flex-col tw:gap-5 tw:pb-4">
        {#each [["tw:w-24", "tw:w-3/5"], ["tw:w-32", "tw:w-2/5"], ["tw:w-20", "tw:w-1/2"]] as [name, body] (name)}
          <div class="tw:flex tw:items-start tw:gap-3">
            <Skeleton class="tw:size-8 tw:shrink-0 tw:rounded-full" />
            <div
              class="tw:flex tw:min-w-0 tw:flex-1 tw:flex-col tw:gap-2 tw:pt-1"
            >
              {@render line(name, "tw:h-2.5")}
              {@render line(body)}
            </div>
          </div>
        {/each}
      </div>
    </div>

    <!-- Like the real cell (safe area) around the composer (its own padding): the two add up. -->
    <div
      aria-hidden="true"
      class="tw:shrink-0 tw:pb-[env(safe-area-inset-bottom)] tw:min-[901px]:pb-0"
    >
      <div
        class="tw:px-3 tw:pt-1 tw:pb-3 tw:min-[640px]:px-4 tw:min-[640px]:pb-4 tw:min-[901px]:px-6"
      >
        <div
          class="tw:flex tw:h-11 tw:items-center tw:gap-2 tw:rounded-[18px] tw:bg-[var(--vb-studio-input-background)] tw:pr-1.5 tw:pl-4 tw:text-muted-foreground tw:shadow-[inset_0_0_0_1px_var(--vb-hairline),0_4px_16px_0_#0000000d]"
        >
          <span class="tw:min-w-0 tw:flex-1 tw:truncate">{t("Mensagem…")}</span>
          <Skeleton class="tw:h-8 tw:w-16 tw:rounded-full" />
        </div>
      </div>
    </div>
  </main>

  <!-- Doc: its tab bar and a few lines, at the width the room opens with
       (vb.docW, the same width animation the room's doc cell seeks). -->
  <section
    aria-hidden="true"
    use:roomDocumentWidth
    class="tw:my-2 tw:mr-2 tw:hidden tw:min-h-0 tw:animate-room-document-width tw:flex-col tw:rounded-surface tw:bg-background tw:shadow-edge tw:min-[901px]:flex"
  >
    <div
      class="tw:flex tw:h-[52px] tw:shrink-0 tw:items-center tw:gap-0.5 tw:border-b tw:border-border tw:px-2"
    >
      <Skeleton class="tw:h-7 tw:w-16 tw:rounded-full" />
      {#each [0, 1, 2, 3, 4] as slot (slot)}
        <span class="tw:grid tw:h-7 tw:w-8 tw:place-items-center"
          ><Skeleton class="tw:size-4 tw:rounded-full" /></span
        >
      {/each}
    </div>
    <div class="tw:flex tw:flex-col tw:gap-3 tw:px-4 tw:pt-4">
      {@render line("tw:w-2/5", "tw:h-4")}
      {@render line("tw:w-full")}
      {@render line("tw:w-5/6")}
      {@render line("tw:w-3/5")}
    </div>
  </section>
</div>
