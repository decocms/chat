<script lang="ts">
  import { cn } from "../../lib/studio/utils";
  import { homeText, type HomeLanguage } from "./copy";
  /**
   * The end of a phone's chat row, as WhatsApp draws it: when, and under it
   * the badges: "@" when it mentions you, then how many are unread (a dot
   * when only an agent wrote). With unread messages the time takes the
   * badge's colour, our purple (the @mention's colour in the chat).
   */
  let {
    time,
    unread = null,
    mention = false,
    lang,
  }: {
    time: string | null;
    unread?: number | "dot" | null;
    mention?: boolean;
    lang: HomeLanguage;
  } = $props();
  const BADGE =
    "flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-purple-text px-1.5 text-[13px] leading-none font-semibold text-background tabular-nums";
</script>

<span
  data-chat-row-end
  class="flex shrink-0 flex-col items-end gap-1.5 self-start pt-0.5"
  >{#if time}<span
      class={[
        "text-base tabular-nums",
        unread
          ? "font-semibold text-brand-purple-text"
          : "text-muted-foreground",
      ]}>{time}</span
    >{/if}{#if mention || unread}<span class="flex items-center gap-1"
      >{#if mention}<span
          role="img"
          data-chat-badge="mention"
          aria-label={homeText(lang, "mentionsYou")}
          class={cn(BADGE, "size-5 px-0 pb-px text-[14px] font-bold")}>@</span
        >{/if}{#if unread === "dot"}<span
          role="img"
          data-chat-badge="dot"
          aria-label={homeText(lang, "newAgent")}
          class="m-[5px] size-2.5 rounded-full bg-brand-purple-text"
        ></span>{:else if unread}<span
          role="img"
          data-chat-badge="unread"
          aria-label={homeText(lang, "unreadCount", { n: unread })}
          class={cn(BADGE)}>{unread > 99 ? "99+" : unread}</span
        >{/if}</span
    >{/if}</span
>
