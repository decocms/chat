import { expect, test } from "bun:test";
import { cardOf } from "../shared/card";
import { inlineCardNodes } from "../svelte/features/chat-interactive/model";
import {
  chartSeriesView,
  fieldDeltaTone,
} from "../svelte/features/chat-interactive/chartProjection";
const chart = {
  kind: "line",
  labels: ["A", "B", "C"],
  series: [
    { name: "Revenue", values: [0, 40, 80] },
    { name: "Cost", values: [-20, 10, 0] },
    { name: "Other", values: [5, 10, 20] },
    { name: "Fourth", values: [2, 1, 0] },
  ],
};
test("normalized four-series chart retains legend, real axis and label-wide hover values", () => {
  const card = cardOf(
      {
        root: "c",
        elements: {
          c: { type: "Card", children: ["v"] },
          v: { type: "Chart", props: chart },
        },
      },
      "abc123",
    ),
    node = card.elements.v;
  expect(node.type).toBe("Chart");
  if (node.type !== "Chart" || !("series" in node.props))
    throw Error("Expected normalized multi chart");
  const view = chartSeriesView(node.props.labels, node.props.series);
  expect(view.axis).toEqual(["80", "30", "-20"]);
  expect(view.mid).toBe("B");
  expect(view.series.map((row) => row.name)).toEqual([
    "Revenue",
    "Cost",
    "Other",
    "Fourth",
  ]);
  expect(new Set(view.series.map((row) => row.color)).size).toBe(4);
  expect(view.hits[1].title).toBe(
    "B\nRevenue: 40\nCost: 10\nOther: 10\nFourth: 1",
  );
  expect(view.series.every((row) => !/(NaN|Infinity)/.test(row.points))).toBe(
    true,
  );
  expect(() =>
    cardOf(
      {
        root: "c",
        elements: {
          c: { type: "Card", children: ["v"] },
          v: {
            type: "Chart",
            props: { ...chart, series: [...chart.series, chart.series[0]] },
          },
        },
      },
      "abc123",
    ),
  ).toThrow();
});
test("legacy charts and opposing finite extremes stay finite and dense multi charts respect output budget", () => {
  const legacy = cardOf(
    {
      root: "c",
      elements: {
        c: { type: "Card", children: ["v"] },
        v: {
          type: "Chart",
          props: { kind: "bar", data: [{ label: "Old", value: 2 }] },
        },
      },
    },
    "abc123",
  );
  expect(inlineCardNodes(legacy).has("v")).toBe(true);
  const extreme = chartSeriesView(
    ["min", "max"],
    [{ name: "finite", values: [-Number.MAX_VALUE, Number.MAX_VALUE] }],
  );
  expect(extreme.series[0].points).toBe("0.0,100.0 300.0,0.0");
  expect(extreme.series[0].bars).toEqual([100, 100]);
  const elements: Record<string, unknown> = {
    c: { type: "Card", children: ["one", "two", "three"] },
  };
  for (const id of ["one", "two", "three"])
    elements[id] = {
      type: "Chart",
      props: {
        kind: "line",
        labels: Array.from({ length: 30 }, (_, i) => String(i)),
        series: chart.series.map((row) => ({
          name: row.name,
          values: Array(30).fill(1),
        })),
      },
    };
  const dense = cardOf({ root: "c", elements }, "abc123");
  expect(inlineCardNodes(dense).size).toBe(1);
});
test("Field direction and primary links preserve typed metadata without interpreting text as HTML", () => {
  expect(fieldDeltaTone("-3%", "down")).toBe("success");
  expect(fieldDeltaTone("−3%", "down")).toBe("success");
  expect(fieldDeltaTone("↓3%", "down")).toBe("success");
  expect(fieldDeltaTone("+3%", "down")).toBe("destructive");
  expect(fieldDeltaTone("+3%")).toBe("success");
  for (const value of ["0%", "±2%", "=0", ""])
    expect(fieldDeltaTone(value)).toBe("neutral");
  const card = cardOf(
    {
      root: "c",
      elements: {
        c: { type: "Card", children: ["fields", "actions"] },
        fields: { type: "Fields", children: ["f"] },
        f: {
          type: "Field",
          props: {
            label: "Value",
            value: "4",
            delta: "-3%",
            good: "down",
            trend: "<img src=x>",
          },
        },
        actions: { type: "Actions", children: ["l"] },
        l: {
          type: "LinkButton",
          props: {
            label: "Go",
            url: "https://example.test/",
            style: "primary",
          },
        },
      },
    },
    "abc123",
  );
  expect(card.elements.f.props).toMatchObject({
    delta: "-3%",
    good: "down",
    trend: "<img src=x>",
  });
  expect(card.elements.l.props).toMatchObject({ style: "primary" });
});
