import {
  BarChartSquare02,
  Check,
  Clock,
  Columns03,
  File02,
  File06,
  Paperclip,
  type IconNode,
} from "../../lib/studio/icons";
import type { DocumentPane } from "./types";

// The ✻ of the agents: six round-capped spokes.
const AGENTS: IconNode = [0, 60, 120].map(
  (angle) =>
    [
      "line",
      {
        x1: "12",
        y1: "3.5",
        x2: "12",
        y2: "20.5",
        transform: `rotate(${angle} 12 12)`,
      },
    ] as const,
);

export const paneIcons: Record<DocumentPane, IconNode> = {
  doc: File02,
  board: Columns03,
  files: Paperclip,
  apps: BarChartSquare02,
  decisions: Check,
  reminders: Clock,
  agents: AGENTS,
  view: File06,
};

export function paneLabel(pane: DocumentPane, en: boolean): string {
  switch (pane) {
    case "doc":
      return "Doc";
    case "board":
      return en ? "Tasks" : "Tarefas";
    case "files":
      return en ? "Files" : "Arquivos";
    case "apps":
      return "Apps";
    case "decisions":
      return en ? "Decisions" : "Decisões";
    case "reminders":
      return en ? "Reminders" : "Lembretes";
    case "agents":
      return "Agents";
    case "view":
      return en ? "Beside chat" : "Ao lado";
    default: {
      const unknown: never = pane;
      return unknown;
    }
  }
}
