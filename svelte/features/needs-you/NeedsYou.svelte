<script lang="ts">
  import Snapshot from "../../lib/ui/Snapshot.svelte";
  import Heading from "../../lib/ui/Heading.svelte";
  import Button from "../../lib/ui/Button.svelte";
  import IconButton from "../../lib/ui/IconButton.svelte";
  import type { ChatBridge } from "../../chatTypes";
  import type { NeedsItem, NeedsView } from "./model";
  import type { NeedsYouSession } from "./session";
  import type { RequestRoomCommand } from "../../roomConnection";
  import { needsSummaries } from "./summary";
  let {
    view,
    owner,
    vb,
    request,
  }: {
    view: NeedsView;
    owner: NeedsYouSession;
    vb: ChatBridge;
    request?: RequestRoomCommand;
  } = $props();
  // One or two written lines lead the card (Gui #2602); asked again only when the items change.
  let asked = "";
  $effect(() => {
    const texts = view.items.map((item) => item.text),
      key = JSON.stringify([view.binding, texts]);
    if (!request || !texts.length || key === asked) return;
    asked = key;
    void request({
      t: "needs.summary",
      thread: view.binding.thread,
      items: texts,
    });
  });
  const summary = $derived(
    $needsSummaries[`${view.binding.roomId}|${view.binding.thread}`],
  );
  const subtitle = (item: NeedsItem) =>
    item.kind === "ask"
      ? vb.t("{who} pediu", { who: vb.name(item.author ?? "") })
      : vb.t(
          item.kind === "agent"
            ? "seu Claude espera você"
            : item.kind === "review"
              ? "sua tarefa esperando OK"
              : item.kind === "doing"
                ? "sua tarefa, fazendo"
                : "sua tarefa, a fazer",
        );
  const short = (text: string) =>
    text.length > 200 ? `${text.slice(0, 198)}…` : text;
</script>

{#if view.items.length || view.busy || view.error}
  <section
    data-native-needs-you
    data-vb-native
    aria-label={vb.t("O que precisa de você aqui")}
    class="tw:mx-3 tw:mt-4 tw:space-y-2 tw:rounded-surface tw:border tw:border-warning/30 tw:bg-warning/10 tw:p-3 tw:font-sans tw:text-foreground"
  >
    <div class="tw:flex tw:flex-wrap tw:items-center tw:gap-2">
      <Heading level={3} class="tw:m-0 tw:text-sm tw:font-semibold"
        >{vb.t("O que precisa de você aqui")}</Heading
      >
      <span class="tw:flex-1 tw:text-xs tw:text-foreground"
        >{vb.t("só você vê")}</span
      >
      {#key JSON.stringify( [view.binding, view.items.map((item) => item.signature)] )}<Snapshot
          value={{ binding: view.binding, items: view.items }}
          >{#snippet children(intent)}<Button
              size="sm"
              variant="ghost"
              disabled={view.busy || !view.items.length}
              onclick={(event) => {
                if (event.currentTarget.isConnected)
                  owner.dismiss(intent.binding, intent.items);
              }}>{vb.t("Dispensar")}</Button
            >{/snippet}</Snapshot
        >{/key}
    </div>
    {#if summary}<p data-needs-summary class="tw:m-0 tw:text-sm tw:leading-6">
        {summary}
      </p>{:else if view.items.length}<p
        data-needs-summary-wait
        class="tw:m-0 tw:grid tw:gap-1.5"
      >
        <i
          class="tw:block tw:h-3 tw:w-full tw:animate-pulse tw:rounded-md tw:bg-warning/20"
        ></i><i
          class="tw:block tw:h-3 tw:w-3/5 tw:animate-pulse tw:rounded-md tw:bg-warning/20"
        ></i>
      </p>{/if}
    <details open={!summary}>
      <summary class="tw:cursor-pointer tw:text-xs tw:text-muted-foreground"
        >{vb.t("{n} itens", { n: view.items.length })}</summary
      >
      <ul class="tw:m-0 tw:list-none tw:space-y-1 tw:p-0">
        {#each view.items as item (item.signature)}<Snapshot
            value={{ binding: view.binding, item }}
            >{#snippet children(intent)}<li
                class="tw:flex tw:items-center tw:gap-2"
              >
                {#if intent.item.messageId}<Button
                    variant="ghost"
                    class="tw:h-auto tw:min-w-0 tw:flex-1 tw:flex-col tw:items-start tw:gap-1 tw:whitespace-normal tw:p-2 tw:text-left"
                    onclick={(event) => {
                      if (event.currentTarget.isConnected)
                        owner.navigate(intent.binding, intent.item);
                    }}
                    ><span class="tw:break-words"
                      >{short(intent.item.text)}</span
                    ><span class="tw:text-xs tw:text-foreground"
                      >{subtitle(intent.item)}</span
                    ></Button
                  >
                {:else}<span
                    class="tw:grid tw:min-w-0 tw:flex-1 tw:gap-1 tw:p-2"
                    ><span class="tw:break-words"
                      >{short(intent.item.text)}</span
                    ><span class="tw:text-xs tw:text-foreground"
                      >{subtitle(intent.item)}</span
                    ></span
                  >{/if}
                <IconButton
                  icon="check"
                  label={vb.t("Feito / não é comigo")}
                  disabled={view.busy}
                  onclick={(event) => {
                    if (event.currentTarget.isConnected)
                      owner.dismiss(intent.binding, [intent.item]);
                  }}
                />
              </li>{/snippet}</Snapshot
          >{/each}
      </ul>
    </details>
    {#if view.busy}<p role="status" class="tw:m-0 tw:text-xs">
        {vb.t("Salvando…")}
      </p>{/if}
    {#if view.error}<div
        role="status"
        class="tw:flex tw:flex-wrap tw:items-center tw:gap-2 tw:text-sm"
      >
        <span>{vb.t("Não deu pra resolver agora. Tente de novo.")}</span
        >{#key view.operation}<Snapshot
            value={{ binding: view.binding, operation: view.operation }}
            >{#snippet children(intent)}<Button
                size="sm"
                variant="outline"
                onclick={(event) => {
                  if (event.currentTarget.isConnected)
                    owner.retry(intent.binding, intent.operation);
                }}>{vb.t("Tentar de novo")}</Button
              >{/snippet}</Snapshot
          >{/key}
      </div>{/if}
  </section>
{/if}
