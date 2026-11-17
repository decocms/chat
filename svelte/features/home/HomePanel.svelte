<script lang="ts">
  import { onMount, onDestroy, untrack, tick } from "svelte";
  import { MediaQuery } from "svelte/reactivity";
  import Button from "../../lib/studio/Button.svelte";
  import InstallCard from "../pwa/InstallCard.svelte";
  import Badge from "../../lib/studio/Badge.svelte";
  import Card from "../../lib/studio/Card.svelte";
  import Heading from "../../lib/ui/Heading.svelte";
  import Spinner from "../../lib/studio/Spinner.svelte";
  import ChatField from "../composer/ChatField.svelte";
  import { createApplicationCopy } from "../application/copy";
  import OrgAvatar from "../../lib/components/OrgAvatar.svelte";
  import type { HomeBridge } from "./types";
  import { createHomeSession } from "./session";
  import { homeText, homeIssue } from "./copy";
  import {
    recentRooms,
    destinations,
    roomIcon,
    targetHref,
    waitGroups,
    waitKind,
    type WaitKind,
  } from "./model";
  import Icon from "../../lib/studio/Icon.svelte";
  import { Inbox01 } from "../../lib/studio/icons";
  import RoomTile from "./RoomTile.svelte";
  import WaitList from "./WaitList.svelte";
  import Onboarding from "../onboarding/Onboarding.svelte";
  import { createOnboardingSession } from "../onboarding/session";
  let {
    pwa,
    personal,
    rooms,
    profile,
    creator,
    onlanguage,
    lang,
    ago,
    onnavigate,
    onhome,
    onarchived,
    onnew,
    onsettings,
    onroomsettings,
    onsearch,
    oninbox,
  }: HomeBridge = $props();
  const account = $derived(personal.state),
    draft = $derived(personal.draft);
  const mobile = new MediaQuery("(max-width:720px)");
  const session = untrack(() => createHomeSession(personal, onnavigate)),
    view = session.state;
  const onboarding = untrack(() => {
      let storage: Storage | null = null;
      try {
        storage = localStorage;
      } catch {
        /* Browser storage may be disabled. */
      }
      return createOnboardingSession(personal, profile, creator, { storage });
    }),
    onboardingView = onboarding.state;
  const text = (
    key: Parameters<typeof homeText>[1],
    vars?: Record<string, string | number>,
  ) => homeText(lang, key, vars);
  const t = $derived(createApplicationCopy(lang));
  let sendButton = $state<HTMLElement | null>(null);
  const suggestion = $derived($view.result);
  const groups = $derived(waitGroups($account.me?.waits ?? []));
  // Triage filters over the same groups; a filter with nothing in it hides.
  let filter = $state<"all" | WaitKind>("all");
  let expanded = $state<Record<string, boolean>>({});
  const filters = $derived.by(() => {
    const waits = $account.me?.waits ?? [];
    const count = (kind: WaitKind) =>
      waits.filter((wait) => waitKind(wait) === kind).length;
    return [
      { kind: "all" as const, label: text("filterAll"), count: waits.length },
      {
        kind: "claude" as const,
        label: text("filterClaude"),
        count: count("claude"),
      },
      {
        kind: "asks" as const,
        label: text("filterAsks"),
        count: count("asks"),
      },
      {
        kind: "reviews" as const,
        label: text("filterReviews"),
        count: count("reviews"),
      },
    ];
  });
  const shown = $derived(
    groups
      .map((group) => ({
        ...group,
        total: group.waits.length,
        waits:
          filter === "all"
            ? group.waits
            : group.waits.filter((wait) => waitKind(wait) === filter),
      }))
      .filter((group) => group.waits.length),
  );
  const plainClick = (event: MouseEvent) =>
    !(event.ctrlKey || event.metaKey || event.shiftKey || event.altKey);
  $effect(() => {
    if (suggestion)
      void tick().then(() => {
        if (sendButton?.isConnected) sendButton.focus();
      });
  });
  let mounted = false,
    agentTimer: ReturnType<typeof setTimeout> | undefined,
    copyStatus = $state("");
  onDestroy(() => {
    onboarding.dispose();
    session.dispose();
  });
  onMount(() => {
    mounted = true;
    void personal.refresh();
    const poll = () => {
      if (!mounted) return;
      if (!$onboardingView.visible && !$account.agents?.agents.length)
        void personal.refreshAgents();
      agentTimer = setTimeout(poll, 15_000);
    };
    poll();
    return () => {
      mounted = false;
      clearTimeout(agentTimer);
      session.dispose();
    };
  });
  const setup = $derived(
    `Read ${location.origin}/llms.txt and set up vibebook for this project.`,
  );
  async function copy() {
    try {
      if (!navigator.clipboard) throw Error("unavailable");
      await navigator.clipboard.writeText(setup);
      if (mounted) copyStatus = "copied";
    } catch {
      if (mounted) copyStatus = "copyFailed";
    }
  }
</script>

{#snippet archiveLink()}<a
    href="/archived?ui=svelte"
    class="tw:text-foreground tw:underline tw:decoration-current/35 tw:underline-offset-4 tw:hover:decoration-current"
    onclick={(event) => {
      if (!plainClick(event)) return;
      event.preventDefault();
      if (event.currentTarget.isConnected) onarchived();
    }}>{text("archive")}</a
  >{/snippet}

{#snippet setupCard()}<Card class="tw:block tw:space-y-4"
    ><Heading level={2} class="tw:m-0 tw:text-lg tw:font-semibold"
      >{text("setup")}</Heading
    >
    <p class="tw:m-0 tw:text-muted-foreground">{text("setupHelp")}</p>
    <code
      class="tw:block tw:whitespace-pre-wrap tw:break-all tw:rounded-control tw:bg-muted tw:p-3 tw:font-mono tw:text-xs"
      >{setup}</code
    ><Button onclick={copy}>{text("copy")}</Button>{#if copyStatus}<p
        role={copyStatus === "copyFailed" ? "alert" : "status"}
      >
        {text(copyStatus === "copyFailed" ? "copyFailed" : "copied")}
      </p>{/if}<Button
      variant="ghost"
      onclick={(event) => {
        if (event.currentTarget.isConnected) onsettings("agents");
      }}>{text("agentSettings")}</Button
    ></Card
  >{/snippet}

{#snippet suggestionCard()}{#if $view.result}{@const choices = destinations(
      $view.result,
    )}{@const selected = choices[$view.selected]!}<Card
      class="tw:block tw:space-y-3 tw:p-4"
      ><p aria-live="polite" class="tw:m-0 tw:break-words">
        {selected.book_id
          ? text("destination", {
              where:
                selected.book_title +
                (selected.epic_title ? " → " + selected.epic_title : ""),
            })
          : text($view.result.pick ? "createDestination" : "noDestination", {
              title: selected.book_title,
            })}
      </p>
      {#if $view.selected === 0 && $view.result.pick && $view.result.reason}<p
          class="tw:m-0 tw:text-muted-foreground"
        >
          {$view.result.reason}
        </p>{/if}
      <div class="tw:flex tw:flex-wrap tw:gap-2">
        <Button
          bind:ref={sendButton}
          aria-busy={$view.busy === "send" || undefined}
          disabled={$view.busy === "send"}
          onclick={() => session.send()}
          >{#if $view.busy === "send"}<Spinner size="xs" />{/if}{text(
            "send",
          )}</Button
        ><Button
          variant="outline"
          disabled={$view.busy === "send"}
          onclick={() => session.cancel()}>{text("cancel")}</Button
        >
      </div>
      <p class="tw:m-0 tw:text-muted-foreground">{text("another")}</p>
      <div class="tw:flex tw:flex-wrap tw:gap-2">
        {#each choices as choice, index}{#if index !== $view.selected}<Button
              variant="ghost"
              disabled={!!$view.busy}
              class="tw:h-auto tw:whitespace-normal tw:text-left"
              onclick={() => {
                session.select(index);
                void tick().then(() => {
                  if (sendButton?.isConnected) sendButton.focus();
                });
              }}
              >{choice.book_id
                ? choice.book_title +
                  (choice.epic_title ? " → " + choice.epic_title : "")
                : text("newDestination", {
                    title: choice.book_title,
                  })}</Button
            >{/if}{/each}
      </div></Card
    >{/if}
  {#if $view.error}<p
      role="alert"
      class="tw:m-0 tw:break-words tw:text-destructive"
    >
      {homeIssue(lang, $view.error)}
    </p>{/if}{/snippet}

<svelte:head><title>vibebook</title></svelte:head>
{#if $onboardingView.visible}
  <Onboarding owner={onboarding} {lang} {onlanguage} />
{:else}
  <!-- Home = triage, at every width: what waits on you leads, grouped by room;
       the ask box is docked at the bottom like a room's composer. Search, + and
       the account menu (profile, friends, agents, notifications, settings,
       theme, language, sign out) live in the rail; on wide screens the rooms
       sit in a column beside the waits. -->
  <main
    data-vb-native="home"
    data-home-layout="triage"
    class="tw:flex tw:min-h-full tw:flex-col tw:bg-background tw:font-sans tw:text-sm tw:leading-6 tw:text-foreground"
  >
    <div
      class="tw:mx-auto tw:flex tw:w-full tw:max-w-5xl tw:flex-1 tw:flex-col tw:gap-4 tw:px-4 tw:pt-4 tw:pb-6 tw:sm:gap-6 tw:sm:px-8 tw:sm:pt-8"
    >
      <InstallCard owner={pwa} {lang} compact />
      {#if !$account.me}{#if $account.loading}<p role="status" class="tw:m-0">
            {text("loading")}
          </p>{/if}{:else}
        {@const me = $account.me}
        <div class="tw:flex tw:items-end tw:justify-between tw:gap-3">
          <div class="tw:min-w-0">
            <p
              class="tw:m-0 tw:flex tw:flex-wrap tw:gap-x-1.5 tw:text-xs tw:leading-5 tw:text-muted-foreground"
            >
              <span
                >{me.name
                  ? text("greeting", { name: me.name.split(" ")[0] ?? "" })
                  : text("home")}</span
              ><span aria-hidden="true">·</span
              >{@render archiveLink()}{#if !me.name || !me.avatar}<span
                  aria-hidden="true">·</span
                ><button
                  type="button"
                  class="tw:cursor-pointer tw:rounded-control tw:p-0 tw:text-foreground tw:underline tw:decoration-current/35 tw:underline-offset-4 tw:hover:decoration-current"
                  onclick={(event) => {
                    if (event.currentTarget.isConnected) onsettings("profile");
                  }}>{text("completeProfile")}</button
                >{/if}
            </p>
            <Heading
              level={1}
              class="tw:m-0 tw:text-2xl tw:font-semibold tw:leading-8 tw:tracking-tight tw:tabular-nums"
              >{me.waits.length
                ? text("waiting", { n: me.waits.length })
                : text("allClear")}</Heading
            >
          </div>
          <div class="tw:flex tw:shrink-0 tw:items-center tw:gap-2">
            {#if oninbox}<Button
                data-native-inbox-toggle
                variant="outline"
                aria-label={text("inbox")}
                aria-haspopup="dialog"
                onclick={(event) => {
                  if (event.currentTarget.isConnected)
                    oninbox?.(event.currentTarget);
                }}
                ><Icon icon={Inbox01} /><span class="tw:max-sm:hidden"
                  >{text("inbox")}</span
                ></Button
              >{/if}<Button
              class="tw:max-sm:hidden"
              onclick={(event) => {
                if (event.currentTarget.isConnected) onnew(event.currentTarget);
              }}>{text("new")}</Button
            >
          </div>
        </div>
        {#if $account.agents && !$account.agents.agents.length}{@render setupCard()}{/if}
        <div
          class="tw:grid tw:gap-6 tw:lg:grid-cols-[minmax(0,1fr)_18rem] tw:lg:items-start"
        >
          {#if groups.length}<section
              aria-label={text("waiting", { n: me.waits.length })}
              class="tw:min-w-0 tw:space-y-3"
            >
              <div
                role="group"
                aria-label={text("waiting", { n: me.waits.length })}
                class="tw:-mx-4 tw:-mt-1 tw:flex tw:gap-1.5 tw:overflow-x-auto tw:px-4 tw:py-1 tw:[scrollbar-width:none] tw:sm:-mx-1 tw:sm:px-1 tw:[&::-webkit-scrollbar]:hidden"
              >
                {#each filters as option (option.kind)}{#if option.kind === "all" || option.count}<Button
                      size="sm"
                      variant={filter === option.kind ? "default" : "outline"}
                      aria-pressed={filter === option.kind}
                      class="tw:shrink-0"
                      onclick={() => (filter = option.kind)}
                      >{option.label}<span
                        class={[
                          "tw:tabular-nums",
                          filter !== option.kind &&
                            (option.kind === "claude"
                              ? "tw:text-destructive"
                              : "tw:text-muted-foreground"),
                        ]}>{option.count}</span
                      ></Button
                    >{/if}{/each}
              </div>
              {#each shown as group (group.roomId)}{@const room = me.books.find(
                  (book) => book.id === group.roomId,
                )}{@const open = !!expanded[group.roomId]}<Card
                  data-native-wait-group={group.roomId}
                  class="tw:block tw:overflow-hidden tw:p-0"
                >
                  <a
                    href={targetHref({ roomId: group.roomId })}
                    aria-label={text("openRoom", { title: group.title })}
                    class="tw:flex tw:min-h-10 tw:min-w-0 tw:items-center tw:gap-2 tw:px-3 tw:pt-2.5 tw:pb-1 tw:text-foreground tw:no-underline tw:outline-none tw:focus-visible:ring-2 tw:focus-visible:ring-inset tw:focus-visible:ring-ring"
                    onclick={(event) => {
                      if (!plainClick(event)) return;
                      event.preventDefault();
                      if (event.currentTarget.isConnected)
                        onnavigate({ roomId: group.roomId });
                    }}
                    >{#if room && roomIcon(room)}<img
                        src={roomIcon(room)}
                        alt=""
                        loading="lazy"
                        class="tw:size-6 tw:shrink-0 tw:rounded-lg tw:object-cover"
                      />{:else}<OrgAvatar name={group.title} size="xs" />{/if}<b
                      class="tw:min-w-0 tw:flex-1 tw:truncate tw:text-[13px] tw:font-semibold"
                      >{group.title}</b
                    ><span
                      class="tw:shrink-0 tw:text-xs tw:tabular-nums tw:text-muted-foreground"
                      ><b class="tw:font-semibold tw:text-foreground"
                        >{group.total}</b
                      > ›</span
                    ></a
                  >
                  <WaitList
                    people={me}
                    waits={open ? group.waits : group.waits.slice(0, 3)}
                    {rooms}
                    {lang}
                    {ago}
                    {onnavigate}
                  />{#if group.waits.length > 3}<button
                      type="button"
                      aria-expanded={open}
                      class="tw:block tw:w-full tw:cursor-pointer tw:border-t tw:border-border tw:py-2.5 tw:pr-3 tw:pl-[3.25rem] tw:text-left tw:text-xs tw:text-muted-foreground tw:outline-none tw:hover:text-foreground tw:focus-visible:ring-2 tw:focus-visible:ring-inset tw:focus-visible:ring-ring"
                      onclick={() =>
                        (expanded = { ...expanded, [group.roomId]: !open })}
                      >{open
                        ? text("showLess")
                        : text("moreHere", {
                            n: group.waits.length - 3,
                          })}</button
                    >{/if}
                </Card>{:else}<p class="tw:m-0 tw:text-muted-foreground">
                  {text("noneHere")}
                </p>{/each}
            </section>{:else}<Card class="tw:block tw:space-y-1 tw:p-4"
              ><p class="tw:m-0 tw:font-semibold">{text("allClear")}</p>
              <p class="tw:m-0 tw:text-muted-foreground">
                {text("allClearHelp")}
              </p></Card
            >{/if}
          <section
            aria-label={text("home")}
            class={[
              "tw:flex tw:min-w-0 tw:flex-col tw:gap-4",
              groups.length && "tw:max-lg:hidden",
            ]}
          >
            <Heading
              level={2}
              class="tw:m-0 tw:flex tw:h-7 tw:items-center tw:text-base tw:font-semibold"
              >{text("home")}</Heading
            >
            {#if !me.books.length}<p class="tw:m-0">{text("empty")}</p>{/if}
            <div
              class="tw:grid tw:grid-cols-4 tw:gap-x-2 tw:gap-y-3 tw:sm:grid-cols-6 tw:lg:grid-cols-4"
            >
              {#each recentRooms(me.books) as room (room.id)}<RoomTile
                  {room}
                  {lang}
                  now={$account.now}
                  seen={$account.seen[room.id] ?? 0}
                  waits={me.waits.filter((wait) => wait.book_id === room.id)}
                  {onnavigate}
                  onsettings={onroomsettings}
                />{/each}
            </div>
          </section>
        </div>
      {/if}
      {#if $account.loading && $account.me}<p role="status" class="tw:m-0">
          {text("refreshing")}
        </p>{/if}
      {#if $account.error}<p
          role="alert"
          class="tw:m-0 tw:break-words tw:text-destructive"
        >
          {homeIssue(lang, $account.error)}
        </p>
        <Button
          variant="outline"
          disabled={$account.loading}
          aria-busy={$account.loading || undefined}
          onclick={(event) => {
            if (event.currentTarget.isConnected) void personal.refresh();
          }}
          >{#if $account.loading}<Spinner size="xs" />{/if}{text(
            "retry",
          )}</Button
        >{/if}
    </div>
    {#if $account.me}<div
        data-home-ask="docked"
        class="tw:sticky tw:bottom-0 tw:z-20 tw:mt-auto tw:bg-background tw:px-4 tw:pt-2 tw:pb-[max(0.75rem,env(safe-area-inset-bottom))] tw:sm:px-8 tw:sm:pb-6"
      >
        <div class="tw:mx-auto tw:max-w-[calc(64rem-4rem)] tw:space-y-2">
          {@render suggestionCard()}
          <ChatField
            id="home-ask"
            maxlength={2000}
            label={text("ask")}
            placeholder={mobile.current ? text("ask") : text("askPlaceholder")}
            value={$draft.ask}
            onedit={(value) => session.edit(value)}
            onsubmit={() => void session.suggest()}
            {t}
            locale={lang === "en" ? "en-US" : "pt-BR"}
            disabled={$view.busy === "send"}
            busy={!!$view.busy}
            pending={$view.busy === "route"}
            sendDisabled={!$draft.ask.trim()}
          >
            {#snippet menu(close, trigger)}<Button
                variant="menu"
                role="menuitem"
                onclick={() => {
                  close();
                  onnew(trigger ?? undefined);
                }}>{text("new")}</Button
              ><Button
                variant="menu"
                role="menuitem"
                onclick={() => {
                  close();
                  onsearch();
                }}>{text("search")} <small>⌘K</small></Button
              >{/snippet}
          </ChatField>
        </div>
      </div>{/if}
  </main>
{/if}
