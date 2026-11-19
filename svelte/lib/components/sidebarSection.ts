/**
 * A titled sidebar section (Epics, Pinned, People, the DM conversations).
 * Desktop: the sidebar does not scroll; each section keeps its title and
 * scrolls its own list. The sections share the free height in equal parts
 * (`flex-1`), but none grows past its content (`max-h-max`), so a short one
 * keeps its full height and gives the rest to the long ones. Never below its
 * title and about one row (`min-h-16`). Phones: full height, and the sheet
 * scrolls whole (one scroll on a small screen).
 */
export const sidebarSection =
  "flex shrink-0 flex-col md:min-h-16 md:max-h-max md:flex-1";

/**
 * The part of a `sidebarSection` that scrolls on desktop. The 4px of padding
 * keep the rows' focus outline inside the scroll box.
 */
export const sectionScroll =
  "md:-mx-1 md:min-h-0 md:overflow-y-auto md:overscroll-contain md:px-1";
