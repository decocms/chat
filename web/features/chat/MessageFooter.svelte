<script lang="ts">
  import PersonAvatar from "../../lib/components/PersonAvatar.svelte";
  import type { ChatBridge } from "../../app/chatTypes";
  import type { MessageFooter } from "./model";
  import { prettyModel } from "./model";
  import AgentMark from "../../lib/components/AgentMark.svelte";
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
  // The first face on top, so each face's agent badge sits over the next one.
  const LAYERS = ["z-[4]", "z-[3]", "z-[2]"] as const;
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
        <!-- At most three faces, each tucked under the one before it with a ring
             in the page's color, then +X in a circle of the same size, then the
             ✓✓ in a small circle tucked in at the bottom, like each face's
             agent badge. -->
        <span class="flex items-end">
          {#each stack as face, i (`${face.who}|${face.email}`)}<span
              data-reader-read={face.read}
              class={["relative inline-flex not-first:-ml-1", LAYERS[i]]}
            >
              <PersonAvatar
                data-avatar="person"
                size="xs"
                class="size-5 shadow-[0_0_0_2px_var(--vb-background)]"
                email={face.email}
                version={vb.avatarVersion(face.email)}
              /><AgentMark
                size="3xs"
                tint
                via={face.who}
                class="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full text-[6px] shadow-[0_0_0_1.5px_var(--vb-background)]"
              />
            </span>{/each}{#if more}<span
              data-readers-more
              class="relative z-[1] -ml-1 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-input text-[9px] font-semibold tabular-nums leading-none text-foreground shadow-[0_0_0_2px_var(--vb-background)]"
              >+{more}</span
            >{/if}{#if footer.readers.length}<span
              aria-hidden="true"
              data-readers-check
              class={[
                "relative z-0 -mb-1 inline-flex h-3.5 min-w-3.5 shrink-0 items-center justify-center rounded-full bg-muted pr-[3px] pl-[4px] text-[8px] font-bold leading-none tracking-[-0.25em] text-muted-foreground shadow-[0_0_0_1.5px_var(--vb-background)]",
                // Under the +X circle's corner, or just under the last face's agent badge.
                more ? "-ml-1.5" : "ml-0",
              ]}>{read ? "✓✓" : "✓"}</span
            >{/if}
        </span>
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
