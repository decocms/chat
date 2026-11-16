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
  import Button from "../../lib/studio/Button.svelte";
  import GridLoader from "../../lib/studio/GridLoader.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import { RefreshCw01, Stars01 } from "../../lib/studio/icons";
  import Skeleton from "../../lib/studio/Skeleton.svelte";
  import Spinner from "../../lib/studio/Spinner.svelte";
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
    "tw:[animation-delay:0ms]",
    "tw:[animation-delay:60ms]",
    "tw:[animation-delay:120ms]",
    "tw:[animation-delay:180ms]",
    "tw:[animation-delay:240ms]",
    "tw:[animation-delay:300ms]",
    "tw:[animation-delay:360ms]",
    "tw:[animation-delay:420ms]",
    "tw:[animation-delay:480ms]",
    "tw:[animation-delay:540ms]",
    "tw:[animation-delay:600ms]",
    "tw:[animation-delay:660ms]",
    "tw:[animation-delay:720ms]",
    "tw:[animation-delay:780ms]",
    "tw:[animation-delay:840ms]",
    "tw:[animation-delay:900ms]",
    "tw:[animation-delay:960ms]",
    "tw:[animation-delay:1020ms]",
    "tw:[animation-delay:1080ms]",
    "tw:[animation-delay:1140ms]",
    "tw:[animation-delay:1200ms]",
    "tw:[animation-delay:1260ms]",
    "tw:[animation-delay:1320ms]",
    "tw:[animation-delay:1380ms]",
    "tw:[animation-delay:1440ms]",
    "tw:[animation-delay:1500ms]",
  ];
  // Storybook also loads a shimmer plugin under the same class name; its no-repeat, right-to-left reversal and reduced-motion reset survive the merge.
  const SHIMMER =
    "tw:bg-[linear-gradient(90deg,color-mix(in_oklab,currentColor_40%,transparent)_38%,currentColor_50%,color-mix(in_oklab,currentColor_40%,transparent)_62%)] tw:bg-[length:250%_100%] tw:bg-clip-text tw:bg-no-repeat tw:[-webkit-text-fill-color:transparent] tw:animate-shimmer tw:rtl:[animation-direction:reverse] tw:motion-reduce:animate-none tw:motion-reduce:bg-none tw:motion-reduce:[-webkit-text-fill-color:currentColor]";
  const STREAM_WORD = "tw:animate-stream-word tw:motion-reduce:animate-none";
  const META =
    "tw:text-[0.75rem] tw:leading-4 tw:tabular-nums tw:text-muted-foreground";

  let run = $state(0);
</script>

<!-- Studio's root line height, which the parity page does not inherit. -->
<div class="tw:leading-[1.5]">
  {#if story === "overview"}
    <Matrix columns={["Cue", "When"]} rows={CUES}>
      {#snippet cell(cue, index)}
        {#if index === 1}
          <span class={META}>{WHEN[cue]}</span>
        {:else if cue === "shimmer"}
          <span class={["tw:text-muted-foreground", SHIMMER, "tw:text-sm"]}>
            Working out how to respond
          </span>
        {:else if cue === "GridLoader"}
          <GridLoader />
        {:else if cue === "stream-word"}
          <span class="tw:text-sm">
            {#each "Each word fades in".split(" ") as word, wordIndex (wordIndex)}
              <span class={[STREAM_WORD, STREAM_DELAYS[wordIndex * 2]]}
                >{word}{#if word}{" "}{/if}</span
              >
            {/each}
          </span>
        {:else if cue === "Spinner"}
          <Spinner class="tw:size-4" />
        {:else if cue === "Skeleton"}
          <Skeleton class="tw:h-4 tw:w-40" />
        {:else}
          <div
            class="tw:animate-revalidating-ring tw:rounded-xl tw:border tw:border-border tw:px-3 tw:py-2 tw:text-sm tw:motion-reduce:animate-none tw:motion-reduce:border-ring"
          >
            Cached card
          </div>
        {/if}
      {/snippet}
    </Matrix>
  {:else if story === "thinking"}
    <div class="tw:flex tw:w-[30rem] tw:items-center tw:gap-2 tw:py-2.5">
      <Icon
        icon={Stars01}
        class="tw:size-4 tw:shrink-0 tw:animate-pulse tw:text-muted-foreground tw:motion-reduce:animate-none"
      />
      <span class={[SHIMMER, "tw:shrink-0 tw:text-sm"]}>Analyzing...</span>
      <span class="tw:min-w-0 tw:flex-1 tw:truncate">
        <span
          class="tw:rounded-[3px] tw:bg-muted/50 tw:px-1 tw:py-px tw:text-xs tw:leading-none tw:text-muted-foreground/60"
        >
          <span class={SHIMMER}>Working out how to respond</span>
        </span>
      </span>
      <span class="tw:text-xs tw:text-muted-foreground/50 tw:tabular-nums"
        >0:04</span
      >
    </div>
  {:else if story === "shimmer-placement"}
    <Matrix
      columns={["On the text", "On the row (don't)"]}
      rows={["Tool call"] as const}
    >
      {#snippet cell(_row, index)}
        {#if index === 0}
          <span class="tw:flex tw:items-center tw:gap-2 tw:text-sm">
            <span class={SHIMMER}>Searching</span>
            <span
              class="tw:rounded-[3px] tw:bg-muted/50 tw:px-1 tw:text-xs tw:text-muted-foreground"
            >
              <span class={SHIMMER}>product pages</span>
            </span>
          </span>
        {:else}
          <span
            class={[SHIMMER, "tw:flex tw:items-center tw:gap-2 tw:text-sm"]}
          >
            <span>Searching</span>
            <span
              class="tw:rounded-[3px] tw:bg-muted/50 tw:px-1 tw:text-xs tw:text-muted-foreground"
            >
              product pages
            </span>
          </span>
        {/if}
      {/snippet}
    </Matrix>
  {:else if story === "generating"}
    <div
      class="tw:flex tw:items-center tw:gap-2.5 tw:text-xs tw:text-muted-foreground/40 tw:select-none"
    >
      <GridLoader />
      <span class="tw:tabular-nums">0:12</span>
    </div>
  {:else if story === "streaming"}
    <div class="tw:flex tw:w-[30rem] tw:flex-col tw:items-start tw:gap-3">
      {#key run}
        <p class="tw:text-sm tw:leading-relaxed tw:text-pretty">
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
