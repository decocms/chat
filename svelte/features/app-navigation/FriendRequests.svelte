<script lang="ts">
  import IconButton from "../../lib/studio/IconButton.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import { Check, X } from "../../lib/studio/icons";
  import PersonAvatar from "../../lib/components/PersonAvatar.svelte";
  import { navRow } from "../../lib/components/navRow";
  import SectionHeader from "../room-sidebar/SectionHeader.svelte";
  import { homeText, type HomeLanguage } from "../home/copy";
  import { avatarUrl } from "../home/model";
  import type { MeFriendRequest } from "../../../shared/schemas";
  /**
   * Who asked to be your friend: a friendship opens a DM, so it needs your
   * yes. Accept adds them back, decline removes the ask (`onanswer`, the
   * application's account API, which refetches your home).
   */
  let {
    requests,
    lang,
    onanswer,
  }: {
    requests: readonly MeFriendRequest[];
    lang: HomeLanguage;
    onanswer?: (email: string, accept: boolean) => Promise<void>;
  } = $props();
  let busy = $state<string | null>(null),
    failed = $state<string | null>(null);
  async function answer(email: string, accept: boolean) {
    if (busy || !onanswer) return;
    busy = email;
    failed = null;
    try {
      await onanswer(email, accept);
    } catch {
      failed = email;
    } finally {
      busy = null;
    }
  }
</script>

{#if requests.length}<section data-friend-requests>
    <SectionHeader level={4} title={homeText(lang, "requests")} />
    <ul class="tw:m-0 tw:flex tw:list-none tw:flex-col tw:gap-0.5 tw:p-0">
      {#each requests as request (request.email)}<li>
          <div
            class={navRow({
              class: "tw:cursor-default tw:hover:bg-transparent",
            })}
          >
            <PersonAvatar
              size="sm"
              name={request.name || request.email}
              url={avatarUrl(request.email, request.avatar)}
            /><span class="tw:min-w-0 tw:flex-1 tw:truncate"
              >{request.name || request.email}</span
            ><IconButton
              label={homeText(lang, "accept")}
              disabled={!!busy || !onanswer}
              onclick={() => answer(request.email, true)}
              ><Icon icon={Check} size={16} /></IconButton
            ><IconButton
              label={homeText(lang, "decline")}
              disabled={!!busy || !onanswer}
              onclick={() => answer(request.email, false)}
              ><Icon icon={X} size={16} /></IconButton
            >
          </div>
          {#if failed === request.email}<p
              role="alert"
              class="tw:m-0 tw:px-2 tw:text-xs tw:text-destructive"
            >
              {homeText(lang, "requestFailed")}
            </p>{/if}
        </li>{/each}
    </ul>
  </section>{/if}
