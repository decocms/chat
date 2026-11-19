import type { ChatBridge } from "../../app/chatTypes";
import type { AgentAccountSession } from "./account";
export type AgentFormatting = Pick<ChatBridge, "t" | "ago">;
export type AgentSettingsProps = {
  owner: AgentAccountSession;
  origin: string;
  vb: AgentFormatting;
  lang?: "pt" | "en";
};
