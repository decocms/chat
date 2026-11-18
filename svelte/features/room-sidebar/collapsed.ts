/** Which room sidebar sections this viewer folded (Pinned, People): kept per browser, for every room. */
export type SidebarSection = "pins" | "people";

const key = (section: SidebarSection) => `vb.sidebarCollapsed.${section}`;

export function readCollapsed(section: SidebarSection): boolean {
  try {
    return localStorage.getItem(key(section)) === "1";
  } catch {
    return false;
  }
}

export function writeCollapsed(section: SidebarSection, collapsed: boolean) {
  try {
    if (collapsed) localStorage.setItem(key(section), "1");
    else localStorage.removeItem(key(section));
  } catch {}
}
