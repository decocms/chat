<script lang="ts">
  import Button from "../../lib/studio/Button.svelte";
  import IconButton from "../../lib/studio/IconButton.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
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
    <div class="flex items-start gap-2 rounded-lg px-2 py-1.5">
      <PersonAvatar size="sm" {email} {version} />
      <div class="min-w-0 flex-1">
        <p class="m-0 truncate text-sm font-medium">{title}</p>
        <p class="m-0 truncate text-xs text-muted-foreground">
          {meta}
        </p>
        {#if preview}<p
            class="m-0 mt-0.5 line-clamp-2 text-xs break-words text-foreground"
          >
            “{preview}”
          </p>{/if}
        <div class="mt-1.5 flex items-center gap-1">
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
            ><Icon icon="x" size={14} /></IconButton
          >
        </div>
        {#if failed === key}<p
            role="alert"
            class="m-0 mt-1 text-xs text-destructive"
          >
            {homeText(lang, "requestFailed")}
          </p>{/if}
      </div>
    </div>
  </li>{/snippet}

{#if invites.length || requests.length}<section data-requests>
    <SectionHeader level={4} title={homeText(lang, "requests")} />
    <ul class="m-0 flex list-none flex-col gap-0.5 p-0">
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
