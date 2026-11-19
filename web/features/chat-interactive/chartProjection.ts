/** Presentation math only; wire validation/limits remain in shared/card. */
export const chartColors = [
  "text-chart-1",
  "text-chart-2",
  "text-chart-3",
  "text-chart-4",
] as const;
export const chartNumber = (value: number) =>
  Math.abs(value) >= 1e6
    ? `${(value / 1e6).toFixed(1).replace(/\.0$/, "")}M`
    : Math.abs(value) >= 1e4
      ? `${(value / 1e3).toFixed(1).replace(/\.0$/, "")}k`
      : String(Math.round(value * 100) / 100);
export function chartSeriesView(
  labels: readonly string[],
  series: readonly { name: string; values: readonly number[] }[],
) {
  // Divide before subtracting to keep opposing finite extremes out of Infinity.
  const values = series.flatMap((row) => row.values),
    scale = Math.max(...values.map(Math.abs), 1);
  const normalized = values.map((value) => value / scale),
    max = Math.max(...normalized, 0),
    min = Math.min(...normalized, 0),
    span = max - min || 1;
  const step = labels.length > 1 ? 300 / (labels.length - 1) : 0;
  return {
    labels,
    axis: [max * scale, ((max + min) / 2) * scale, min * scale].map(
      chartNumber,
    ),
    mid: labels.length > 2 ? labels[Math.floor((labels.length - 1) / 2)] : "",
    series: series.map((row, index) => ({
      name: row.name,
      color: chartColors[index],
      values: row.values,
      bars: row.values.map((value) =>
        Math.round(Math.abs(value / scale) * 100),
      ),
      points: row.values
        .map(
          (value, point) =>
            `${(point * step).toFixed(1)},${(100 - ((value / scale - min) / span) * 100).toFixed(1)}`,
        )
        .join(" "),
    })),
    hits: labels.map((label, index) => ({
      x: index * step - step / 2,
      width: step || 300,
      title: `${label}\n${series.map((row) => `${row.name ? `${row.name}: ` : ""}${row.values[index]}`).join("\n")}`,
    })),
  };
}
export function fieldDeltaTone(
  delta?: string,
  good?: string,
): "success" | "destructive" | "neutral" {
  if (!delta || /^\s*[0±=]/.test(delta)) return "neutral";
  return /^\s*[-−↓]/.test(delta) === (good === "down")
    ? "success"
    : "destructive";
}
