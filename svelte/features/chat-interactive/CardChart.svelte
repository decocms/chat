<script lang="ts">
  import type { CardEl } from "../../../shared/card";
  import type { ChatBridge } from "../../chatTypes";
  import { chartSeriesView, chartNumber } from "./chartProjection";
  import Dialog from "../../lib/ui/Dialog.svelte";
  import Icon from "../../lib/ui/Icon.svelte";
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
  <figure class="tw:m-0 tw:space-y-2">
    {#if chart.title}<figcaption
        class="tw:whitespace-pre-wrap tw:text-sm tw:font-medium"
      >
        {chart.title}
      </figcaption>{/if}
    {#if view.series.length > 1}<div
        data-card-chart-legend
        class="tw:flex tw:flex-wrap tw:gap-x-3 tw:gap-y-1 tw:text-xs"
      >
        {#each view.series as series}<span
            class="tw:inline-flex tw:items-center tw:gap-1"
            ><svg
              viewBox="0 0 10 10"
              aria-hidden="true"
              class={["tw:size-2.5", series.color]}
              ><rect width="10" height="10" fill="currentColor" /></svg
            >{series.name}</span
          >{/each}
      </div>{/if}
    {#if chart.kind === "line"}
      <div class="tw:grid tw:grid-cols-[auto_minmax(0,1fr)] tw:gap-2">
        <div
          data-card-chart-axis
          class="tw:flex tw:h-28 tw:flex-col tw:justify-between tw:text-xs tw:tabular-nums tw:text-muted-foreground"
        >
          {#each view.axis as label}<span>{label}</span>{/each}
        </div>
        <svg
          aria-label={chart.title || vb.t("Gráfico")}
          role="img"
          viewBox="-4 -4 308 108"
          preserveAspectRatio="none"
          class="tw:h-28 tw:w-full tw:overflow-visible"
        >
          {#each [0, 50, 100] as y}<line
              x1="0"
              x2="300"
              y1={y}
              y2={y}
              stroke="currentColor"
              stroke-width="1"
              class="tw:text-border"
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
        class="tw:flex tw:justify-between tw:gap-2 tw:pl-8 tw:text-xs tw:text-muted-foreground"
      >
        <span>{view.labels[0]}</span>{#if view.mid}<span>{view.mid}</span
          >{/if}<span>{view.labels.at(-1)}</span>
      </div>
    {:else}
      {#each view.labels as label, index}<div
          class="tw:grid tw:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] tw:items-center tw:gap-2 tw:text-xs"
        >
          <span class="tw:whitespace-pre-wrap tw:break-words">{label}</span>
          <svg
            viewBox={`0 0 100 ${view.series.length * 8}`}
            preserveAspectRatio="none"
            role="img"
            aria-label={view.hits[index].title}
            class={view.series.length > 2
              ? "tw:h-8 tw:w-full"
              : "tw:h-4 tw:w-full"}
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
          <b class="tw:tabular-nums"
            >{view.series
              .map((series) => chartNumber(series.values[index]))
              .join(" · ")}</b
          >
        </div>{/each}
    {/if}
  </figure>
{/snippet}
<div data-native-card-chart class="tw:space-y-2">
  {#if inline}{@render figure()}{:else}<Dialog
      title={chart.title || vb.t("Gráfico")}
      closeLabel={vb.t("Fechar")}
      fullScreen
      {open}
      {onOpenChange}
    >
      {#snippet trigger()}<Icon name="chart" />{chart.title || vb.t("Gráfico")} ·
        {vb.t("Abrir em tela cheia")}{/snippet}
      {@render figure()}
    </Dialog>{/if}
</div>
