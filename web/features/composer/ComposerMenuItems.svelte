<script lang="ts">
  import type { Snippet } from "svelte";
  import Button from "../../lib/studio/Button.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  /**
   * The + menu of a chat box: attach a file, mention someone, create a poll.
   * The room's composer and the Home's ask box both show it; the ask puts its
   * own items first (`before`) and leaves out mention and poll: it isn't in a
   * room yet, so there's no one to mention and nowhere to vote. An item shows
   * only when its action is given. `allowed` fences a click before the menu
   * closes and the action runs.
   */
  let {
    t,
    close,
    allowed = () => true,
    onattach,
    onmention,
    onroom,
    onpoll,
    before,
  }: {
    t: (text: string, vars?: Record<string, string | number>) => string;
    close: () => void;
    allowed?: (event: Event) => boolean;
    onattach: () => void;
    /** "Mencionar alguém" (@): the room's composer has it; the Home's ask doesn't. */
    onmention?: () => void;
    /** "Mencionar sala" (#): the room's composer has it; the Home's ask doesn't. */
    onroom?: () => void;
    /** "Criar votação": the room's composer has it; the Home's ask doesn't. */
    onpoll?: () => void;
    before?: Snippet;
  } = $props();
  const run = (event: Event, action: () => void) => {
    if (!allowed(event)) return;
    close();
    action();
  };
</script>

{@render before?.()}<Button
  variant="menu"
  role="menuitem"
  onclick={(event) => run(event, onattach)}
  ><Icon icon="paperclip" />{t("Anexar arquivo")}
  <small>{t("ou Cmd+V")}</small></Button
>{#if onmention}<Button
    variant="menu"
    role="menuitem"
    onclick={(event) => run(event, onmention)}
    ><Icon icon="at-sign" />{t("Mencionar alguém")}</Button
  >{/if}{#if onroom}<Button
    variant="menu"
    role="menuitem"
    onclick={(event) => run(event, onroom)}
    ><Icon icon="hash-02" />{t("Mencionar sala")}</Button
  >{/if}{#if onpoll}<Button
    variant="menu"
    role="menuitem"
    onclick={(event) => run(event, onpoll)}
    ><Icon icon="bar-chart-square-02" />{t("Criar votação")}</Button
  >{/if}
