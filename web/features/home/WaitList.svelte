<script lang="ts">
  import PersonAvatar from "../../lib/components/PersonAvatar.svelte";
  import AgentMark from "../../lib/components/AgentMark.svelte";
  import type { MeResult } from "../../../shared/schemas";
  import Badge from "../../lib/studio/Badge.svelte";
  import IconButton from "../../lib/studio/IconButton.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import type { RoomsSession } from "../rooms/session";
  import {
    claudeWait,
    plainWaitText,
    targetHref,
    waitTarget,
    personVersion,
    type Wait,
    type RoomTarget,
  } from "./model";
  import { homeText, homeIssue, type HomeLanguage } from "./copy";
  let {
    waits,
    rooms,
    lang,
    ago,
    onnavigate,
    people,
  }: {
    waits: Wait[];
    people: MeResult;
    rooms: RoomsSession;
    lang: HomeLanguage;
    ago: (time: number) => string;
    onnavigate: (target: RoomTarget) => void;
  } = $props();
  const actions = $derived(rooms.state);
  const text = (
    key: Parameters<typeof homeText>[1],
    vars?: Record<string, string | number>,
  ) => homeText(lang, key, vars);
  const who = (wait: Wait) =>
    claudeWait(wait)
      ? text("yourAgent")
      : wait.author === "ai"
        ? "@vibe"
        : ((wait.author_name || wait.author.split("@")[0] || "").split(
            " ",
          )[0] ?? "");
</script>

<!-- Dense triage rows: who · when, the ask in one or two clean lines, its epic.
     Your agent's asks carry a stripe and a tag; tasks in review a tag. -->
<ul class="m-0 list-none p-0">
  {#each waits as wait (wait.book_id + ":" + wait.ref)}{@const key = `wait:${wait.book_id}:${wait.ref}`}{@const urgent =
      claudeWait(wait)}
    <li
      class={[
        "relative flex items-start gap-2.5 px-3 py-2.5 [&+&]:border-t [&+&]:border-border",
        urgent && "bg-destructive/5",
      ]}
      data-wait={wait.ref}
    >
      {#if urgent}<span
          aria-hidden="true"
          class="absolute top-2.5 bottom-2.5 left-0 w-[3px] rounded-r-full bg-destructive"
        ></span>{/if}
      <!-- Same shapes as the Inbox: an agent waiting on you (a/b refs) and an
           @vibe ask are agent squares; people asking are circles. -->
      {#if urgent}<AgentMark
          class="mt-0.5 text-sm font-normal"
        />{:else if wait.author === "ai"}<AgentMark
          mark="✦"
          class="mt-0.5 text-sm font-normal text-primary"
        />{:else}<PersonAvatar
          size="sm"
          class="mt-0.5"
          email={wait.author}
          version={personVersion(people, wait.author)}
        />{/if}
      <a
        class="min-w-0 flex-1 rounded-control text-foreground no-underline outline-none focus-visible:ring-2 focus-visible:ring-ring"
        href={targetHref(waitTarget(wait))}
        onclick={(event) => {
          if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)
            return;
          event.preventDefault();
          if (event.currentTarget.isConnected) onnavigate(waitTarget(wait));
        }}
      >
        <span
          class="flex min-w-0 items-center gap-1.5 text-xs leading-5 text-muted-foreground"
          ><b class="truncate text-sm font-semibold text-foreground"
            >{who(wait)}</b
          >{#if urgent}<Badge variant="destructive" size="sm"
              >{text("needsYou")}</Badge
            >{:else if wait.ref.startsWith("t")}<Badge
              variant="outline"
              size="sm">{text("inReview")}</Badge
            >{/if}<span class="shrink-0">· {ago(wait.ts)}</span></span
        >
        <span class="line-clamp-2 break-words text-sm leading-5"
          >{plainWaitText(wait.text)}</span
        >
        <span
          class="mt-0.5 block truncate text-xs leading-4 text-muted-foreground"
          ># {wait.topic || text("main")}</span
        >
      </a>
      {#if wait.ref.startsWith("m")}<IconButton
          label={text("resolve")}
          class="shrink-0"
          disabled={!!$actions.pending[key]}
          onclick={(event) => {
            if (event.currentTarget.isConnected)
              void rooms.resolve(wait.book_id, wait.ref);
          }}><Icon icon="check" /></IconButton
        >{/if}
      {#if $actions.issues[key]}<p
          role="alert"
          class="m-0 break-words text-destructive"
        >
          {homeIssue(lang, $actions.issues[key]!)}
        </p>{/if}
    </li>{/each}
</ul>
