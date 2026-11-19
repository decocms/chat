import type { BrowserContext, Page } from "@playwright/test";
import type { DocumentPane } from "../web/features/documents/types";

export type ApplicationProfile = {
  lang: "en" | "pt";
  theme: "light" | "dark";
  width: 1440 | 768 | 390;
};
/** Only real Worker contexts. No caller may install canonical/API response mocks. */
export type ApplicationAuditFixture = {
  base: string;
  roomId: string;
  ownerEmail: string;
  /** Actual agent post used to exercise the existing Markdown/code path. */
  codeMessageId?: number;
  output: string;
  createProfile(
    profile: ApplicationProfile,
  ): Promise<{ context: BrowserContext; page: Page }>;
  openPane(page: Page, pane: Exclude<DocumentPane, "view">): Promise<void>;
  openSidebar(page: Page): Promise<void>;
  step(name: string, run: () => Promise<void>): Promise<void>;
};
