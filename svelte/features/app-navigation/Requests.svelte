<script lang="ts">
  import Button from "../../lib/studio/Button.svelte";
  import IconButton from "../../lib/studio/IconButton.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import { X } from "../../lib/studio/icons";
  import PersonAvatar from "../../lib/components/PersonAvatar.svelte";
  import SectionHeader from "../room-sidebar/SectionHeader.svelte";
  import { homeText, type HomeLanguage } from "../home/copy";
  import type { MeFriendRequest, MeInvite } from "../../../shared/schemas";
  /**
   * "Pedidos": what waits for your yes. A room invite (Entrar joins and opens
   * it) and a message from someone outside your rooms (Aceitar opens the DM
   * with their first message in it). × declines either; nothing from them
   * reaches you before a yes.
   */
  let {
    invites,
    requests,
    lang,
    onjoin,
    onanswer,
  }: {
    invites: readonly MeInvite[];
    requests: readonly MeFriendRequest[];
    lang: HomeLanguage;
    onjoin?: (room: string, yes: boolean) => Promise<void>;
    onanswer?: (email: string, accept: boolean) => Promise<void>;
  } = $props();
  let busy = $state<string | null>(null),
    failed = $state<string | null>(null);
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

{#snippet row(
  key: string,
  email: string,
  version: number | null | undefined,
  title: string,
  meta: string,
  preview: string | null | undefined,
  yesLabel: string,
  answer: ((yes: boolean) => Promise<void>) | undefined,
)}<li data-request={key}>
    <div
      class="tw:flex tw:items-start tw:gap-2 tw:rounded-lg tw:px-2 tw:py-1.5"
    >
      <PersonAvatar size="sm" {email} {version} />
      <div class="tw:min-w-0 tw:flex-1">
        <p class="tw:m-0 tw:truncate tw:text-sm tw:font-medium">{title}</p>
        <p class="tw:m-0 tw:truncate tw:text-xs tw:text-muted-foreground">
          {meta}
        </p>
        {#if preview}<p
            class="tw:m-0 tw:mt-0.5 tw:line-clamp-2 tw:text-xs tw:break-words tw:text-foreground"
          >
            “{preview}”
          </p>{/if}
        <div class="tw:mt-1.5 tw:flex tw:items-center tw:gap-1">
          <Button
            size="xs"
            disabled={!!busy || !answer}
            aria-busy={busy === key || undefined}
            onclick={() => run(key, answer && (() => answer(true)))}
            >{yesLabel}</Button
          ><IconButton
            size="icon-xs"
            label={homeText(lang, "decline")}
            disabled={!!busy || !answer}
            onclick={() => run(key, answer && (() => answer(false)))}
            ><Icon icon={X} size={14} /></IconButton
          >
        </div>
        {#if failed === key}<p
            role="alert"
            class="tw:m-0 tw:mt-1 tw:text-xs tw:text-destructive"
          >
            {homeText(lang, "requestFailed")}
          </p>{/if}
      </div>
    </div>
  </li>{/snippet}

{#if invites.length || requests.length}<section data-requests>
    <SectionHeader level={4} title={homeText(lang, "requests")} />
    <ul class="tw:m-0 tw:flex tw:list-none tw:flex-col tw:gap-0.5 tw:p-0">
      {#each invites as invite (invite.book_id)}{@render row(
          `room:${invite.book_id}`,
          invite.inviter,
          invite.inviter_avatar,
          invite.title,
          homeText(lang, "inviteFrom", {
            who: invite.inviter_name || invite.inviter,
            people:
              invite.people === 1
                ? homeText(lang, "onePerson")
                : homeText(lang, "nPeople", { n: invite.people }),
          }),
          null,
          homeText(lang, "join"),
          onjoin && ((yes) => onjoin(invite.book_id, yes)),
        )}{/each}
      {#each requests as request (request.email)}{@render row(
          `dm:${request.email}`,
          request.email,
          request.avatar,
          request.name || request.email,
          homeText(lang, "wantsToTalk"),
          request.msg,
          homeText(lang, "accept"),
          onanswer && ((yes) => onanswer(request.email, yes)),
        )}{/each}
    </ul>
  </section>{/if}
