import type { IconName } from "../../lib/studio/icons";
import type { DocumentPane } from "./types";

export const paneIcons: Record<DocumentPane, IconName> = {
  doc: "file-02",
  board: "columns-03",
  files: "paperclip",
  apps: "bar-chart-square-02",
  decisions: "check",
  reminders: "clock",
  agents: "app-agents",
  people: "users-01",
  search: "search-md",
  view: "file-06",
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
    case "people":
      return en ? "People" : "Pessoas";
    case "search":
      return en ? "Search" : "Busca";
    case "view":
      return en ? "Beside chat" : "Ao lado";
    default: {
      const unknown: never = pane;
      return unknown;
    }
  }
}
