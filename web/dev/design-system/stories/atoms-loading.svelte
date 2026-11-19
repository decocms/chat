<script lang="ts" module>
  export const layouts = {
    overview: "padded",
    thinking: "padded",
    "shimmer-placement": "padded",
    generating: "padded",
    streaming: "padded",
  };
</script>

<script lang="ts">
  import Button from "../../../lib/studio/Button.svelte";
  import GridLoader from "../../../lib/studio/GridLoader.svelte";
  import Icon from "../../../lib/studio/Icon.svelte";
  import { RefreshCw01, Stars01 } from "../../../lib/studio/icons";
  import Skeleton from "../../../lib/studio/Skeleton.svelte";
  import Spinner from "../../../lib/studio/Spinner.svelte";
  import Matrix from "../Matrix.svelte";

  let { story }: { story: string } = $props();

  const REPLY =
    "I checked the three product pages and found 12 images without alt text. I drafted descriptions for each one and opened a task to review them.";
  const CUES = [
    "shimmer",
    "GridLoader",
    "stream-word",
    "Spinner",
    "Skeleton",
    "revalidating-ring",
  ] as const;
  const WHEN = {
    shimmer: "Text for work in progress: thinking, a running tool",
    GridLoader: "The agent is generating a reply",
    "stream-word": "Streamed text as it arrives",
    Spinner: "A button or field waiting on a request",
    Skeleton: "Content that has never loaded",
    "revalidating-ring": "Cached content refreshing in the background",
  };
  // One word every 60ms; a delay is a class, so each step is spelled out.
  const STREAM_DELAYS = [
    "[animation-delay:0ms]",
    "[animation-delay:60ms]",
    "[animation-delay:120ms]",
    "[animation-delay:180ms]",
    "[animation-delay:240ms]",
    "[animation-delay:300ms]",
    "[animation-delay:360ms]",
    "[animation-delay:420ms]",
    "[animation-delay:480ms]",
    "[animation-delay:540ms]",
    "[animation-delay:600ms]",
    "[animation-delay:660ms]",
    "[animation-delay:720ms]",
    "[animation-delay:780ms]",
    "[animation-delay:840ms]",
    "[animation-delay:900ms]",
    "[animation-delay:960ms]",
    "[animation-delay:1020ms]",
    "[animation-delay:1080ms]",
    "[animation-delay:1140ms]",
    "[animation-delay:1200ms]",
    "[animation-delay:1260ms]",
    "[animation-delay:1320ms]",
    "[animation-delay:1380ms]",
    "[animation-delay:1440ms]",
    "[animation-delay:1500ms]",
  ];
  // Storybook also loads a shimmer plugin under the same class name; its no-repeat, right-to-left reversal and reduced-motion reset survive the merge.
  const SHIMMER =
    "bg-[linear-gradient(90deg,color-mix(in_oklab,currentColor_40%,transparent)_38%,currentColor_50%,color-mix(in_oklab,currentColor_40%,transparent)_62%)] bg-[length:250%_100%] bg-clip-text bg-no-repeat [-webkit-text-fill-color:transparent] animate-shimmer rtl:[animation-direction:reverse] motion-reduce:animate-none motion-reduce:bg-none motion-reduce:[-webkit-text-fill-color:currentColor]";
  const STREAM_WORD = "animate-stream-word motion-reduce:animate-none";
  const META = "text-[0.75rem] leading-4 tabular-nums text-muted-foreground";

  let run = $state(0);
</script>

<!-- Studio's root line height, which this page does not inherit. -->
<div class="leading-[1.5]">
  {#if story === "overview"}
    <Matrix columns={["Cue", "When"]} rows={CUES}>
      {#snippet cell(cue, index)}
        {#if index === 1}
          <span class={META}>{WHEN[cue]}</span>
        {:else if cue === "shimmer"}
          <span class={["text-muted-foreground", SHIMMER, "text-sm"]}>
            Working out how to respond
          </span>
        {:else if cue === "GridLoader"}
          <GridLoader />
        {:else if cue === "stream-word"}
          <span class="text-sm">
            {#each "Each word fades in".split(" ") as word, wordIndex (wordIndex)}
              <span class={[STREAM_WORD, STREAM_DELAYS[wordIndex * 2]]}
                >{word}{#if word}{" "}{/if}</span
              >
            {/each}
          </span>
        {:else if cue === "Spinner"}
          <Spinner class="size-4" />
        {:else if cue === "Skeleton"}
          <Skeleton class="h-4 w-40" />
        {:else}
          <div
            class="animate-revalidating-ring rounded-xl border border-border px-3 py-2 text-sm motion-reduce:animate-none motion-reduce:border-ring"
          >
            Cached card
          </div>
        {/if}
      {/snippet}
    </Matrix>
  {:else if story === "thinking"}
    <div class="flex w-[30rem] items-center gap-2 py-2.5">
      <Icon
        icon={Stars01}
        class="size-4 shrink-0 animate-pulse text-muted-foreground motion-reduce:animate-none"
      />
      <span class={[SHIMMER, "shrink-0 text-sm"]}>Analyzing...</span>
      <span class="min-w-0 flex-1 truncate">
        <span
          class="rounded-[3px] bg-muted/50 px-1 py-px text-xs leading-none text-muted-foreground/60"
        >
          <span class={SHIMMER}>Working out how to respond</span>
        </span>
      </span>
      <span class="text-xs text-muted-foreground/50 tabular-nums">0:04</span>
    </div>
  {:else if story === "shimmer-placement"}
    <Matrix
      columns={["On the text", "On the row (don't)"]}
      rows={["Tool call"] as const}
    >
      {#snippet cell(_row, index)}
        {#if index === 0}
          <span class="flex items-center gap-2 text-sm">
            <span class={SHIMMER}>Searching</span>
            <span
              class="rounded-[3px] bg-muted/50 px-1 text-xs text-muted-foreground"
            >
              <span class={SHIMMER}>product pages</span>
            </span>
          </span>
        {:else}
          <span class={[SHIMMER, "flex items-center gap-2 text-sm"]}>
            <span>Searching</span>
            <span
              class="rounded-[3px] bg-muted/50 px-1 text-xs text-muted-foreground"
            >
              product pages
            </span>
          </span>
        {/if}
      {/snippet}
    </Matrix>
  {:else if story === "generating"}
    <div
      class="flex items-center gap-2.5 text-xs text-muted-foreground/40 select-none"
    >
      <GridLoader />
      <span class="tabular-nums">0:12</span>
    </div>
  {:else if story === "streaming"}
    <div class="flex w-[30rem] flex-col items-start gap-3">
      {#key run}
        <p class="text-sm leading-relaxed text-pretty">
          <!-- The space sits in its own block so it is a second text node, as in React; Chrome measures one merged node a hair narrower. -->
          {#each REPLY.split(" ") as word, index (index)}
            <span class={[STREAM_WORD, STREAM_DELAYS[index]]}
              >{word}{#if word}{" "}{/if}</span
            >
          {/each}
        </p>
      {/key}
      <Button size="sm" variant="outline" onclick={() => (run += 1)}>
        <Icon icon={RefreshCw01} /> Replay
      </Button>
    </div>
  {/if}
</div>
