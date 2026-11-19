<script lang="ts">
  import type { CardEl } from "../../../shared/card";
  import type { ChatBridge } from "../../chatTypes";
  import { chartSeriesView, chartNumber } from "./chartProjection";
  import Dialog from "../../lib/studio/Dialog.svelte";
  import DialogContent from "../../lib/studio/DialogContent.svelte";
  import DialogHeader from "../../lib/studio/DialogHeader.svelte";
  import DialogTitle from "../../lib/studio/DialogTitle.svelte";
  import DialogTrigger from "../../lib/studio/DialogTrigger.svelte";
  import { buttonVariants } from "../../lib/studio/button";
  import Icon from "../../lib/studio/Icon.svelte";
  import { BarChartSquare02 } from "../../lib/studio/icons";
  let {
    chart,
    vb,
    inline = true,
    open = false,
    onOpenChange,
  }: {
    chart: Extract<CardEl, { type: "Chart" }>["props"];
    vb: Pick<ChatBridge, "t">;
    inline?: boolean;
    open?: boolean;
    onOpenChange: (open: boolean) => void;
  } = $props();
  const view = $derived(
    "series" in chart
      ? chartSeriesView(chart.labels, chart.series)
      : chartSeriesView(
          chart.data.map((point) => point.label),
          [
            {
              name: chart.title || "",
              values: chart.data.map((point) => point.value),
            },
          ],
        ),
  );
</script>

{#snippet figure()}
  <figure class="m-0 space-y-2">
    {#if chart.title}<figcaption
        class="whitespace-pre-wrap text-sm font-medium"
      >
        {chart.title}
      </figcaption>{/if}
    {#if view.series.length > 1}<div
        data-card-chart-legend
        class="flex flex-wrap gap-x-3 gap-y-1 text-xs"
      >
        {#each view.series as series}<span
            class="inline-flex items-center gap-1"
            ><svg
              viewBox="0 0 10 10"
              aria-hidden="true"
              class={["size-2.5", series.color]}
              ><rect width="10" height="10" fill="currentColor" /></svg
            >{series.name}</span
          >{/each}
      </div>{/if}
    {#if chart.kind === "line"}
      <div class="grid grid-cols-[auto_minmax(0,1fr)] gap-2">
        <div
          data-card-chart-axis
          class="flex h-28 flex-col justify-between text-xs tabular-nums text-muted-foreground"
        >
          {#each view.axis as label}<span>{label}</span>{/each}
        </div>
        <svg
          aria-label={chart.title || vb.t("Gráfico")}
          role="img"
          viewBox="-4 -4 308 108"
          preserveAspectRatio="none"
          class="h-28 w-full overflow-visible"
        >
          {#each [0, 50, 100] as y}<line
              x1="0"
              x2="300"
              y1={y}
              y2={y}
              stroke="currentColor"
              stroke-width="1"
              class="text-border"
            />{/each}
          {#each view.series as series}<polyline
              points={series.points}
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              vector-effect="non-scaling-stroke"
              stroke-linejoin="round"
              class={series.color}
            />{/each}
          {#each view.hits as hit}<rect
              x={hit.x}
              y="0"
              width={hit.width}
              height="100"
              fill="transparent"><title>{hit.title}</title></rect
            >{/each}
        </svg>
      </div>
      <div
        class="flex justify-between gap-2 pl-8 text-xs text-muted-foreground"
      >
        <span>{view.labels[0]}</span>{#if view.mid}<span>{view.mid}</span
          >{/if}<span>{view.labels.at(-1)}</span>
      </div>
    {:else}
      {#each view.labels as label, index}<div
          class="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] items-center gap-2 text-xs"
        >
          <span class="whitespace-pre-wrap break-words">{label}</span>
          <svg
            viewBox={`0 0 100 ${view.series.length * 8}`}
            preserveAspectRatio="none"
            role="img"
            aria-label={view.hits[index].title}
            class={view.series.length > 2 ? "h-8 w-full" : "h-4 w-full"}
          >
            {#each view.series as series, seriesIndex}<rect
                x="0"
                y={seriesIndex * 8}
                width={series.bars[index]}
                height="6"
                rx="1"
                fill="currentColor"
                class={series.color}
                ><title
                  >{label} · {series.name ? `${series.name}: ` : ""}{series
                    .values[index]}</title
                ></rect
              >{/each}
          </svg>
          <b class="tabular-nums"
            >{view.series
              .map((series) => chartNumber(series.values[index]))
              .join(" · ")}</b
          >
        </div>{/each}
    {/if}
  </figure>
{/snippet}
<div data-native-card-chart class="space-y-2">
  {#if inline}{@render figure()}{:else}<Dialog {open} {onOpenChange}>
      <DialogTrigger class={buttonVariants({ variant: "outline", size: "sm" })}
        ><Icon icon={BarChartSquare02} size={16} />{chart.title ||
          vb.t("Gráfico")} ·
        {vb.t("Abrir em tela cheia")}</DialogTrigger
      >
      <DialogContent
        class="inset-2 top-2 left-2 flex w-auto max-w-none translate-x-0 translate-y-0 flex-col overflow-auto font-sans text-sm text-foreground md:max-w-none"
        closeLabel={vb.t("Fechar")}
        preventScroll={false}
        preventBodyPointerEvents={false}
        preventOverflowTextSelection={false}
      >
        <DialogHeader>
          <DialogTitle class="pr-8 font-sans"
            >{chart.title || vb.t("Gráfico")}</DialogTitle
          >
        </DialogHeader>
        {@render figure()}
      </DialogContent>
    </Dialog>{/if}
</div>
