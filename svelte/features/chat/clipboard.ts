/** iOS gesture fallback is preserved; all authored styling uses the sole Tailwind entry. */
export async function copyChatText(text: string): Promise<void> {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.readOnly = true;
  textarea.className = "fixed left-0 top-0 opacity-0 text-base";
  const focused = document.activeElement;
  document.body.append(textarea);
  textarea.focus({ preventScroll: true });
  textarea.setSelectionRange(0, text.length);
  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch {
  } finally {
    textarea.remove();
    if (focused instanceof HTMLElement && focused.isConnected)
      focused.focus({ preventScroll: true });
  }
  if (copied) return;
  if (!navigator.clipboard) throw new Error("clipboard unavailable");
  await navigator.clipboard.writeText(text);
}
