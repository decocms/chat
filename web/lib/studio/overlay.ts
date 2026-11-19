/** Radix selects an input's text when a popover, dialog or sheet moves focus into it on open; Bits UI only focuses it. */
export function selectTextOnAutoFocus(content: HTMLElement | null): void {
  content?.addEventListener(
    "focusin",
    (event) => {
      if (event.target instanceof HTMLInputElement) event.target.select();
    },
    { once: true },
  );
}

/** Context key under which `AlertDialog` hands its close function to `AlertDialogAction`. */
export const ALERT_DIALOG_CLOSE = Symbol("studio-alert-dialog-close");

/** Radix puts `data-state` on a dialog's trigger, overlay and content only; Bits UI adds it to the close buttons too, where a button styled for `data-[state=open]` would light up. */
export function withoutDataState(
  props: Record<string, unknown>,
): Record<string, unknown> {
  const own = { ...props };
  delete own["data-state"];
  return own;
}
