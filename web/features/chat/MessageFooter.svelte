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
      })),
  ]);
  const STACK = 3;
  const stack = $derived(faces.slice(0, STACK));
  const more = $derived(Math.max(0, faces.length - STACK));
  const label = $derived(
    !footer.readers.length
      ? vb.t("Agents que olharam")
      : read === footer.readers.length
        ? vb.t("visto por {n}", { n: read })
        : vb.t("visto por {n} de {m}", { n: read, m: footer.readers.length }),
  );
  const who = (model: string, email: string) =>
    vb.t("{via} de {who}", { via: prettyModel(model), who: vb.name(email) });
</script>

{#snippet oneFace(face: (typeof faces)[number])}<span
    data-reader-read={face.read}
    class="relative inline-flex"
    ><PersonAvatar
      data-avatar="person"
      size="xs"
      class="size-5 ring-2 ring-background"
      email={face.email}
      version={vb.avatarVersion(face.email)}
    /><AgentMark
      size="3xs"
      tint
      via={face.who}
      class="absolute -bottom-0.5 -left-0.5 size-2.5 rounded-full text-[6px] ring-[1.5px] ring-background"
    /></span
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
        <!-- On a phone, one face and "+N": the faces live in the text's right gutter (Message), narrower there. -->
        <AvatarStack
          size="sm"
          class="max-md:hidden"
          items={stack}
          key={(face) => `${face.who}|${face.email}`}
          {more}
          after={footer.readers.length ? check : undefined}
          face={oneFace}
        /><AvatarStack
          size="sm"
          class="md:hidden"
          items={faces.slice(0, 1)}
          key={(face) => `${face.who}|${face.email}`}
          more={faces.length - 1}
          after={footer.readers.length ? check : undefined}
          face={oneFace}
        />
      </Button>
      {#if shown}<div
          id={`${ids}-readers`}
          role="tooltip"
          class="absolute bottom-full right-0 z-20 mb-2 w-72 max-w-[80vw] space-y-2 rounded-surface border border-border bg-popover p-3 text-popover-foreground shadow-md"
        >
          {#each footer.readers as reader (`${reader.receipt.who}|${reader.receipt.email}`)}<div
              class="flex items-center gap-2"
            >
              <PersonAvatar
                data-avatar="person"
                size="xs"
                email={reader.receipt.email}
                version={vb.avatarVersion(reader.receipt.email)}
              /><span class="min-w-0 flex-1 break-words"
                >{who(reader.receipt.who, reader.receipt.email)}</span
              ><span>{vb.t(reader.read ? "leu" : "recebeu")}</span>
            </div>{/each}{#each footer.passed as status (`${status.ack.who}|${status.ack.email}`)}<div
              data-ack-state="idle"
              class="flex items-center gap-2"
            >
              <PersonAvatar
                data-avatar="person"
                size="xs"
                email={status.ack.email}
                version={vb.avatarVersion(status.ack.email)}
              /><span class="min-w-0 flex-1 break-words"
                >{who(status.ack.who, status.ack.email)}</span
              ><span
                >{vb.t("parou")} ·
                <time title={vb.dateTime?.(status.ack.ts)}
                  >{vb.ago(status.ack.ts)}</time
                ></span
              >
            </div>{/each}
        </div>{/if}
    </div>
  {/if}
</div>
