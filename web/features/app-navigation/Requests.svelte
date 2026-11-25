<script lang="ts">
  import Button from "../../lib/studio/Button.svelte";
  import IconButton from "../../lib/studio/IconButton.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import PersonAvatar from "../../lib/components/PersonAvatar.svelte";
  import type { NavRowVariant } from "../../lib/components/navRow";
  import SectionHeader from "../room-sidebar/SectionHeader.svelte";
  import RoomAvatar from "../rooms/RoomAvatar.svelte";
  import { homeText, type HomeLanguage } from "../home/copy";
  import type {
    MeFriendRequest,
    MeInvite,
    OrgRoom,
  } from "../../../shared/schemas";
  /**
   * "Pedidos": what waits for your yes, one row each, built like the rows
   * around it. A room invite: the room's avatar with the inviter's face on
   * its corner, "{who} te convidou" and Entrar (joins and opens it). A message
   * from someone outside your rooms: their face, their first message and
   * Aceitar (opens the DM with it). × declines either; nothing from them
   * reaches you before a yes. `variant` follows the rows around it: the
   * sidebar's small rows or the phone list's bigger ones. `center`: rows of
   * the user center (the sidebar's on desktop, the Chats list's on a phone),
   * like "Your agent", with no section title and the × on hover or always on
   * a touch screen (docs/design.md, "The user center"; Gimenes #5064).
   * Then "Da sua empresa": rooms open to your company email domain
   * that you did not join, the same rows with only Entrar (nothing to
   * decline: no one asked you). In the user center they have no title.
   */
  let {
    invites,
    requests,
    company = [],
    lang,
    variant = "sidebar",
    center = false,
    onjoin,
    onanswer,
    oncompany,
  }: {
    invites: readonly MeInvite[];
    requests: readonly MeFriendRequest[];
    /** Rooms open to your company domain (GET /api/org/rooms): only their cover. */
    company?: readonly OrgRoom[];
    lang: HomeLanguage;
    variant?: NavRowVariant;
    center?: boolean;
    onjoin?: (room: string, yes: boolean) => Promise<void>;
    onanswer?: (email: string, accept: boolean) => Promise<void>;
    /** Joins a room open to your company and opens it. */
    oncompany?: (room: string) => Promise<void>;
  } = $props();
  type Face = { email: string; version: number | null | undefined };
  /** What stands for a request: a room (with who invited you) or a person. */
  type Cover =
    { kind: "room"; title: string; by: Face } | ({ kind: "person" } & Face);
  let busy = $state<string | null>(null),
    failed = $state<string | null>(null);
  const small = $derived(variant === "sidebar");
  const count = $derived(invites.length + requests.length);
  async function run(key: string, task: (() => Promise<void>) | undefined) {
    if (busy || !task) return;
    busy = key;
    failed = null;
    try {
      await task();
    } catch {
      failed = key;
    } finally {
      busy = null;
    }
  }
</script>

{#snippet cover(of: Cover)}
  {#if of.kind === "room"}<span class="relative inline-flex shrink-0"
      ><RoomAvatar
        size={small ? "xs" : "md"}
        title={of.title}
        {lang}
        surface={small ? "sidebar" : "background"}
      /><PersonAvatar
        email={of.by.email}
        version={of.by.version}
        size={small ? "3xs" : "2xs"}
        aria-hidden="true"
        class={[
          "absolute -right-1 -bottom-1 rounded-full ring-2",
          small ? "ring-sidebar" : "ring-background",
        ].join(" ")}
      /></span
    >{:else}<PersonAvatar
      email={of.email}
      version={of.version}
      size={small ? "xs" : "md"}
      aria-hidden="true"
    />{/if}
{/snippet}

{#snippet row(
  key: string,
  of: Cover,
  title: string,
  meta: string,
  full: string | undefined,
  yesLabel: string,
  answer: ((yes: boolean) => Promise<void>) | undefined,
  declinable: boolean = true,
)}<li data-request={key}>
    <div
      class={[
        "flex min-w-0 items-center font-sans",
        center
          ? "group min-h-12 gap-2.5 rounded-lg px-2.5 py-2 text-sm hover:bg-sidebar-accent"
          : small
            ? "min-h-9 gap-2 px-2 py-1 text-sm"
            : "min-h-12 gap-3 px-2 py-1.5",
      ]}
    >
      {@render cover(of)}
      <span class="flex min-w-0 flex-1 flex-col">
        <span class={["truncate", center && "font-medium"]}>{title}</span>
        <span
          class="truncate text-xs leading-4 text-muted-foreground"
          title={full}>{meta}</span
        >
      </span>
      <span
        class={[
          "flex shrink-0 items-center gap-0.5",
          center && "flex-row-reverse",
        ]}
      >
        <Button
          size="xs"
          disabled={!!busy || !answer}
          aria-busy={busy === key || undefined}
          onclick={() => run(key, answer && (() => answer(true)))}
          >{yesLabel}</Button
        >{#if declinable}<IconButton
            size="icon-xs"
            label={homeText(lang, "decline")}
            class={center
              ? "hidden text-muted-foreground group-focus-within:inline-flex group-hover:inline-flex hover:text-foreground [@media(hover:none)]:inline-flex"
              : "text-muted-foreground hover:text-foreground"}
            disabled={!!busy || !answer}
            onclick={() => run(key, answer && (() => answer(false)))}
            ><Icon icon="x" size={14} /></IconButton
          >{/if}
      </span>
    </div>
    {#if failed === key}<p
        role="alert"
        class={[
          "m-0 pb-1 text-xs text-destructive",
          small ? "pr-2 pl-10" : "pr-2 pl-14",
        ]}
      >
        {homeText(lang, "requestFailed")}
      </p>{/if}
  </li>{/snippet}

{#if count}<section data-requests={center ? "center" : ""}>
    {#if !center}<SectionHeader level={4} title={homeText(lang, "requests")}>
        {#snippet action()}<span
            class="px-1.5 text-xs leading-4 text-muted-foreground tabular-nums"
            >{count}</span
          >{/snippet}
      </SectionHeader>{/if}
    <ul class="m-0 flex list-none flex-col gap-0.5 p-0">
      {#each invites as invite (invite.book_id)}{@render row(
          `room:${invite.book_id}`,
          {
            kind: "room",
            title: invite.title,
            by: { email: invite.inviter, version: invite.inviter_avatar },
          },
          invite.title,
          homeText(lang, "inviteFrom", {
            who: invite.inviter_name || invite.inviter,
          }),
          undefined,
          homeText(lang, "join"),
          onjoin && ((yes) => onjoin(invite.book_id, yes)),
        )}{/each}
      {#each requests as request (request.email)}{@render row(
          `dm:${request.email}`,
          { kind: "person", email: request.email, version: request.avatar },
          request.name || request.email,
          request.msg ? `“${request.msg}”` : homeText(lang, "wantsToTalk"),
          request.msg ?? undefined,
          homeText(lang, "accept"),
          onanswer && ((yes) => onanswer(request.email, yes)),
        )}{/each}
    </ul>
  </section>{/if}
{#if company.length}<section
    data-company-rooms
    class={count && !center ? "mt-3" : ""}
  >
    {#if !center}<SectionHeader
        level={4}
        title={homeText(lang, "fromCompany")}
      />{/if}
    <ul class="m-0 flex list-none flex-col gap-0.5 p-0">
      {#each company as room (room.id)}{@const who =
          room.opened_by_name || room.opened_by || ""}{@render row(
          `org:${room.id}`,
          {
            kind: "room",
            title: room.title,
            by: { email: room.opened_by ?? room.id, version: null },
          },
          room.title,
          homeText(lang, room.people === 1 ? "openedByOne" : "openedBy", {
            who,
            n: room.people,
          }),
          undefined,
          homeText(lang, "join"),
          oncompany && (async (yes) => (yes ? oncompany(room.id) : undefined)),
          false,
        )}{/each}
    </ul>
  </section>{/if}
