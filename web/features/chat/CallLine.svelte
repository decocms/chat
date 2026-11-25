<script lang="ts">
  import { onDestroy } from "svelte";
  import PersonAvatar from "../../lib/components/PersonAvatar.svelte";
  import Button from "../../lib/studio/Button.svelte";
  import IconButton from "../../lib/studio/IconButton.svelte";
  import Icon from "../../lib/studio/Icon.svelte";
  import type { Room } from "../../../shared/room";
  import type { ChatBridge, ChatMessage } from "../../app/chatTypes";
  import { isRecorder, parseCallLine } from "../../../shared/call";
  import { callIntent } from "../call/ring";
  /** A call's line in the chat (a message with tag "call", src/book.ts callStarted), like a system line: a phone,
   *  who and what, the time. While the call is on, "Entrar"; while a DM's call rings me, the ringing block. */
  let {
    message: m,
    room,
    vb,
  }: { message: ChatMessage; room: Room; vb: ChatBridge } = $props();
  const line = $derived(parseCallLine(m.text));
  const people = $derived(
    (room.call ?? []).filter((peer) => !isRecorder(peer.email)),
  );
  const on = $derived(line?.state === "on" && people.length > 0);
  const inIt = $derived(people.some((peer) => peer.email === room.me));
  // The ring ends at its time even when no word comes (a lost notice).
  let now = $state(Date.now());
  const ring = $derived(
    room.ring &&
      room.ring.to === room.me &&
      room.ring.from === m.author &&
      room.ring.until > now &&
      on
      ? room.ring
      : null,
  );
  let timer: ReturnType<typeof setTimeout> | undefined;
  $effect(() => {
    clearTimeout(timer);
    const until = room.ring?.until;
    if (until && until > Date.now())
      timer = setTimeout(() => (now = Date.now()), until - Date.now() + 50);
  });
  onDestroy(() => clearTimeout(timer));
  const first = (email: string) => vb.name(email).split(/\s+/)[0] ?? email;
  const other = $derived(
    room.members.find((email) => email !== m.author) ?? "",
  );
  // The name goes in bold: the sentence is split where it is.
  const MARK = "\u0000";
  const sentence = $derived.by(() => {
    if (!line) return null;
    if (line.state === "missed")
      return m.author === room.me
        ? {
            text: vb.t("{name} não atendeu.", { name: MARK }),
            name: first(other),
          }
        : {
            text: vb.t("Você perdeu uma call de {name}.", { name: MARK }),
            name: first(m.author),
          };
    return {
      text: vb.t("{name} iniciou uma call.", { name: MARK }),
      name: m.author === room.me ? vb.t("Você") : first(m.author),
    };
  });
  const join = () => callIntent.set({ room: room.id, action: "join" });
  const decline = () => callIntent.set({ room: room.id, action: "decline" });
</script>

{#if ring}<div
    id={`m${m.id}`}
    data-chat-message={m.id}
    data-call-ringing
    class="mx-3 mt-3 flex items-center gap-3 rounded-xl bg-muted p-3 font-sans text-sm"
  >
    <PersonAvatar
      email={ring.from}
      version={vb.avatarVersion(ring.from)}
      size="md"
      class="shrink-0 animate-pulse motion-reduce:animate-none"
    />
    <div class="min-w-0 flex-1">
      <p class="m-0 truncate font-medium text-foreground">
        {vb.name(ring.from)}
      </p>
      <p class="m-0 truncate text-xs text-muted-foreground">
        {vb.t("Ligando para você…")}
      </p>
    </div>
    <IconButton
      data-ring-decline
      label={vb.t("Recusar")}
      variant="destructive"
      class="size-10 shrink-0 rounded-full text-destructive-foreground hover:bg-destructive"
      onclick={decline}><Icon icon="phone-hang-up" size={18} /></IconButton
    >
    <IconButton
      data-ring-answer
      label={vb.t("Atender")}
      variant="success"
      class="size-10 shrink-0 rounded-full"
      onclick={join}><Icon icon="phone" size={18} /></IconButton
    >
  </div>{:else if line && sentence}<div
    id={`m${m.id}`}
    data-chat-message={m.id}
    data-call-line={line.state}
    class="mt-3 flex items-center gap-3 px-3 py-1 font-sans text-sm text-muted-foreground"
  >
    <span
      class={[
        "flex size-8 shrink-0 items-center justify-center rounded-full",
        line.state === "missed"
          ? "bg-muted text-muted-foreground"
          : "bg-success text-success-foreground",
      ]}><Icon icon="phone" size={14} /></span
    >
    <p class="m-0 min-w-0 flex-1">
      {sentence.text.split(MARK)[0]}<strong class="font-medium text-foreground"
        >{sentence.name}</strong
      >{sentence.text.split(MARK)[1]}{#if line.state === "ended"}<span>
          · {vb.t("Call de {n} min", { n: line.minutes })}</span
        >{/if}
      <time class="ml-1 text-xs" datetime={new Date(m.ts).toISOString()}
        >{vb.hhmm(m.ts)}</time
      >
    </p>
    {#if on && !inIt}<Button
        data-call-line-join
        size="sm"
        variant="success"
        class="shrink-0 rounded-full"
        onclick={join}
        ><Icon icon="phone" size={14} />{vb.t("Entrar na call")}</Button
      >{/if}
  </div>{:else}<p
    id={`m${m.id}`}
    data-chat-message={m.id}
    class="m-0 mt-3 px-3 font-sans text-sm text-muted-foreground"
  >
    {m.text}
  </p>{/if}
