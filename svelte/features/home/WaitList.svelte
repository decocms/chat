<script lang="ts">
  import PersonAvatar from "../../lib/components/PersonAvatar.svelte";
  import AgentMark from "../../lib/components/AgentMark.svelte";
  import type { MeResult } from "../../../shared/schemas";
  import Badge from "../../lib/studio/Badge.svelte";
  import IconButton from "../../lib/studio/IconButton.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import { Check } from "../../lib/studio/icons";
  import type { RoomsSession } from "../rooms/session";
  import {
    claudeWait,
    plainWaitText,
    targetHref,
    waitTarget,
    personAvatar,
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
      ? text("yourClaude")
      : wait.author === "ai"
        ? "@vibe"
        : ((wait.author_name || wait.author.split("@")[0] || "").split(
            " ",
          )[0] ?? "");
</script>

<!-- Dense triage rows: who · when, the ask in one or two clean lines, its epic.
     Your Claude's asks carry a stripe and a tag; tasks in review a tag. -->
<ul class="tw:m-0 tw:list-none tw:p-0">
  {#each waits as wait (wait.book_id + ":" + wait.ref)}{@const key = `wait:${wait.book_id}:${wait.ref}`}{@const urgent =
      claudeWait(wait)}
    <li
      class={[
        "tw:relative tw:flex tw:items-start tw:gap-2.5 tw:px-3 tw:py-2.5 tw:[&+&]:border-t tw:[&+&]:border-border",
        urgent && "tw:bg-destructive/5",
      ]}
      data-native-wait={wait.ref}
    >
      {#if urgent}<span
          aria-hidden="true"
          class="tw:absolute tw:top-2.5 tw:bottom-2.5 tw:left-0 tw:w-[3px] tw:rounded-r-full tw:bg-destructive"
        ></span>{/if}
      <!-- Same shapes as the Inbox: an agent waiting on you (a/b refs) and an
           @vibe ask are agent squares; people asking are circles. -->
      {#if urgent}<AgentMark
          class="tw:mt-0.5 tw:text-sm tw:font-normal"
        />{:else if wait.author === "ai"}<AgentMark
          mark="✦"
          class="tw:mt-0.5 tw:text-sm tw:font-normal tw:text-primary"
        />{:else}<PersonAvatar
          size="sm"
          class="tw:mt-0.5"
          name={wait.author_name || wait.author}
          url={personAvatar(people, wait.author)}
        />{/if}
      <a
        class="tw:min-w-0 tw:flex-1 tw:rounded-control tw:text-foreground tw:no-underline tw:outline-none tw:focus-visible:ring-2 tw:focus-visible:ring-ring"
        href={targetHref(waitTarget(wait))}
        onclick={(event) => {
          if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)
            return;
          event.preventDefault();
          if (event.currentTarget.isConnected) onnavigate(waitTarget(wait));
        }}
      >
        <span
          class="tw:flex tw:min-w-0 tw:items-center tw:gap-1.5 tw:text-xs tw:leading-5 tw:text-muted-foreground"
          ><b
            class="tw:truncate tw:text-[13px] tw:font-semibold tw:text-foreground"
            >{who(wait)}</b
          >{#if urgent}<Badge variant="destructive" size="sm"
              >{text("needsYou")}</Badge
            >{:else if wait.ref.startsWith("t")}<Badge
              variant="outline"
              size="sm">{text("inReview")}</Badge
            >{/if}<span class="tw:shrink-0">· {ago(wait.ts)}</span></span
        >
        <span class="tw:line-clamp-2 tw:break-words tw:text-sm tw:leading-5"
          >{plainWaitText(wait.text)}</span
        >
        <span
          class="tw:mt-0.5 tw:block tw:truncate tw:text-xs tw:leading-4 tw:text-muted-foreground"
          ># {wait.topic || text("main")}</span
        >
      </a>
      {#if wait.ref.startsWith("m")}<IconButton
          label={text("resolve")}
          class="tw:shrink-0"
          disabled={!!$actions.pending[key]}
          onclick={(event) => {
            if (event.currentTarget.isConnected)
              void rooms.resolve(wait.book_id, wait.ref);
          }}><Icon icon={Check} /></IconButton
        >{/if}
      {#if $actions.issues[key]}<p
          role="alert"
          class="tw:m-0 tw:break-words tw:text-destructive"
        >
          {homeIssue(lang, $actions.issues[key]!)}
        </p>{/if}
    </li>{/each}
</ul>
