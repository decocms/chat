<script lang="ts">
  import PersonAvatar from "../../lib/components/PersonAvatar.svelte";
  import type { ChatBridge } from "../../app/chatTypes";
  import type { MessageFooter } from "./model";
  import { prettyModel } from "./model";
  import AgentMark from "../../lib/components/AgentMark.svelte";
  import AvatarStack from "../../lib/components/AvatarStack.svelte";
  import Button from "../../lib/studio/Button.svelte";
  let { footer, vb }: { footer: MessageFooter; vb: ChatBridge } = $props();
  let opened = $state(false),
    hovered = $state(false),
    focused = $state(false),
    dismissed = $state(false);
  const shown = $derived(!dismissed && (opened || hovered || focused));
  const ids = $props.id();
  const read = $derived(footer.readers.filter((r) => r.read).length);
  // Readers and the agents that looked and passed, one face each.
  const faces = $derived([
    ...footer.readers.map((r) => ({
      who: r.receipt.who,
      email: r.receipt.email,
      read: r.read as boolean | undefined,
      person: !!r.receipt.person,
    })),
    ...footer.passed
      .filter(
        (p) =>
          !footer.readers.some(
            (r) =>
              r.receipt.who === p.ack.who && r.receipt.email === p.ack.email,
          ),
      )
      .map((p) => ({
        who: p.ack.who,
        email: p.ack.email,
        read: undefined as boolean | undefined,
        person: false,
      })),
  ]);
  const STACK = 3;
  const stack = $derived(faces.slice(0, STACK));
  const more = $derived(Math.max(0, faces.length - STACK));
  const count = $derived(
    !footer.readers.length
      ? vb.t("Agents que olharam")
      : read === footer.readers.length
        ? vb.t("visto por {n}", { n: read })
        : vb.t("visto por {n} de {m}", { n: read, m: footer.readers.length }),
  );
  const who = (model: string, email: string) =>
    vb.t("{via} de {who}", { via: prettyModel(model), who: vb.name(email) });
  /** A reader's name: a person's own ("Ana"), an agent's with its person ("Claude Opus 5.5 de Ana"). */
  const readerName = (reader: MessageFooter["readers"][number]) =>
    reader.receipt.person
      ? vb.name(reader.receipt.email)
      : who(reader.receipt.who, reader.receipt.email);
  // "Visto por Ana, Bia e Claude de Ana": who read it, people first (the model's order), in the app's language. The
  // stack's accessible name (a screen reader hears the names); the popover's title is only "Visto por", its rows name them.
  const seenBy = $derived.by(() => {
    const names = footer.readers.filter((r) => r.read).map(readerName);
    if (!names.length) return "";
    let list: string;
    try {
      list = new Intl.ListFormat(vb.locale, { type: "conjunction" }).format(
        names,
      );
    } catch {
      list = names.join(", ");
    }
    return vb.t("Visto por {names}", { names: list });
  });
  const label = $derived(
    seenBy && read < footer.readers.length
      ? `${seenBy} · ${count}`
      : seenBy || count,
  );
</script>

<!-- A row's face in the popover: a person's own avatar, or an agent's ✻ tile with its person in the corner, as the
     messages draw them. -->
{#snippet rowAvatar(
  email: string,
  via?: string,
)}{#if via === undefined}<PersonAvatar
      data-avatar="person"
      size="xs"
      {email}
      version={vb.avatarVersion(email)}
    />{:else}<span class="relative size-6 shrink-0"
      ><AgentMark {via} tint size="xs" class="text-xs" /><PersonAvatar
        data-avatar="person"
        size="2xs"
        {email}
        version={vb.avatarVersion(email)}
        class="absolute -right-1 -bottom-1 size-3.5 ring-2 ring-popover"
      /></span
    >{/if}{/snippet}

<!-- A row's name: a person's own; an agent's model, then whose agent it is, muted ("Claude Code de Ana"). -->
{#snippet rowName(email: string, via?: string)}<span
    class="min-w-0 flex-1 break-words"
    >{#if via === undefined}{vb.name(email)}{:else}{prettyModel(via)}
      <span data-reader-owner class="text-muted-foreground"
        >{vb.t("de {who}", { who: vb.name(email) })}</span
      >{/if}</span
  >{/snippet}

{#snippet check()}<span
    aria-hidden="true"
    data-readers-check
    class="inline-flex h-3.5 min-w-3.5 shrink-0 items-center justify-center rounded-full bg-muted pr-[3px] pl-[4px] text-[8px] font-bold leading-none tracking-[-0.25em] text-muted-foreground ring-2 ring-background"
    >{read ? "✓✓" : "✓"}</span
  >{/snippet}

<div
  data-message-footer
  class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"
>
  {#each footer.statuses as status (`${status.ack.who}|${status.ack.email}`)}
    <span
      data-ack-state={status.kind}
      class={status.kind === "blocked"
        ? "whitespace-pre-wrap break-words text-warning"
        : "whitespace-pre-wrap break-words"}
    >
      {#if status.kind === "blocked"}⏸ {vb.t("{who} espera você no terminal", {
          who: who(status.ack.who, status.ack.email),
        })}{status.ack.note ? `: ${status.ack.note}` : ""}
      {:else if status.kind === "doing"}<span
          aria-hidden="true"
          class="inline-block animate-spin motion-reduce:animate-none">✻</span
        >
        {vb.t("{who} está fazendo isso", {
          who: who(status.ack.who, status.ack.email),
        })}
      {:else if status.kind === "done"}✓ {vb.t("{who} fez isso", {
          who: who(status.ack.who, status.ack.email),
        })}
      {:else if status.kind === "waiting"}⏳ {vb.t("aguardando {who}", {
          who: status.owners.map(vb.name).join(", "),
        })}
      {:else}– {vb.t("{who} parou", {
          who: who(status.ack.who, status.ack.email),
        })}{/if}
      {#if ["blocked", "doing", "idle"].includes(status.kind)}
        · <time title={vb.dateTime?.(status.ack.ts)}
          >{vb.ago(status.ack.ts)}</time
        >{/if}
    </span>
  {/each}
  {#if faces.length}
    <div
      role="group"
      aria-label={label}
      class="relative"
      onpointerenter={() => {
        hovered = true;
        dismissed = false;
      }}
      onpointerleave={() => {
        hovered = false;
      }}
    >
      <Button
        variant="ghost"
        size="sm"
        class="h-auto gap-1 px-1 py-1"
        aria-label={label}
        aria-expanded={shown}
        aria-controls={`${ids}-readers`}
        aria-describedby={shown ? `${ids}-readers` : undefined}
        onfocus={() => {
          focused = true;
          dismissed = false;
        }}
        onblur={() => {
          focused = false;
          opened = false;
        }}
        onclick={() => {
          opened = !opened;
          dismissed = !opened;
        }}
        onkeydown={(event) => {
          if (event.key === "Escape") {
            dismissed = true;
            opened = false;
            event.stopPropagation();
          }
        }}
      >
        <!-- The same stack as the phone's room bar: at most three faces, each on
             top of the one to its left, then +X, then the ✓✓ on top, tucked into
             the last one's bottom-right. Each face's agent badge sits at its
             bottom-left, so the face to its right never covers it. -->
        <AvatarStack
          size="sm"
          items={stack}
          key={(face) => `${face.who}|${face.email}`}
          {more}
          after={footer.readers.length ? check : undefined}
          >{#snippet face(face)}<span
              data-reader-read={face.read}
              data-reader-person={face.person || undefined}
              class="relative inline-flex"
              >{#if face.person}<PersonAvatar
                  data-avatar="person"
                  size="xs"
                  class="size-5 ring-2 ring-background"
                  email={face.email}
                  version={vb.avatarVersion(face.email)}
                />{:else}<!-- As in the messages: the agent's ✻ tile, its person in the corner (bottom-left here, where the next face never covers it). --><AgentMark
                  size="xs"
                  tint
                  via={face.who}
                  class="size-5 text-[10px] ring-2 ring-background"
                /><PersonAvatar
                  data-avatar="person"
                  size="3xs"
                  class="absolute -bottom-0.5 -left-0.5 size-2.5 ring-[1.5px] ring-background"
                  email={face.email}
                  version={vb.avatarVersion(face.email)}
                />{/if}</span
            >{/snippet}</AvatarStack
        >
      </Button>
      {#if shown}<div
          id={`${ids}-readers`}
          role="tooltip"
          class="absolute bottom-full right-0 z-20 mb-2 w-72 max-w-[80vw] space-y-2 rounded-surface border border-border bg-popover p-3 text-popover-foreground shadow-md"
        >
          {#if seenBy}<p data-readers-seen-by class="m-0 mb-1 font-medium">
              {vb.t("Visto por")}
            </p>{/if}
          <!-- Five rows and half of the sixth (the cut shows there is more), then the list scrolls inside: a message many saw keeps a small popover. -->
          <div
            data-readers-list
            class="-mx-3 max-h-44 space-y-2 overflow-y-auto overscroll-contain px-3"
          >
            {#each footer.readers as reader (`${reader.receipt.who}|${reader.receipt.email}`)}<div
                data-reader-row={reader.receipt.person ? "person" : "agent"}
                class="flex items-center gap-2"
              >
                {@render rowAvatar(
                  reader.receipt.email,
                  reader.receipt.person ? undefined : reader.receipt.who,
                )}{@render rowName(
                  reader.receipt.email,
                  reader.receipt.person ? undefined : reader.receipt.who,
                )}<span
                  >{vb.t(
                    reader.read
                      ? "leu"
                      : reader.receipt.person
                        ? "leu em parte"
                        : "recebeu",
                  )}</span
                >
              </div>{/each}{#each footer.passed as status (`${status.ack.who}|${status.ack.email}`)}<div
                data-ack-state="idle"
                data-reader-row="agent"
                class="flex items-center gap-2"
              >
                {@render rowAvatar(
                  status.ack.email,
                  status.ack.who,
                )}{@render rowName(status.ack.email, status.ack.who)}<span
                  >{vb.t("parou")} ·
                  <time title={vb.dateTime?.(status.ack.ts)}
                    >{vb.ago(status.ack.ts)}</time
                  ></span
                >
              </div>{/each}
          </div>
        </div>{/if}
    </div>
  {/if}
</div>
