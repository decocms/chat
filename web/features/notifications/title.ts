/** The browser tab's name: the number of things in your Inbox first, like "(3) Room · deco.chat", so a tab in the
 *  background shows that something waits for you. */
export function tabTitle(name: string, inbox: number) {
  return inbox > 0 ? `(${inbox > 99 ? "99+" : inbox}) ${name}` : name;
}
