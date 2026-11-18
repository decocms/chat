<script lang="ts">
  import { onDestroy, untrack } from "svelte";
  import type { Suggestion } from "../../../shared/room";
  import type { SuggestionPreviewProps } from "./types";
  import { suggestionIdentity } from "./model";
  import Snapshot from "../../lib/components/Snapshot.svelte";
  import Button from "../../lib/studio/Button.svelte";
  import MutationStatus from "./MutationStatus.svelte";
  let { room, index, owner, vb }: SuggestionPreviewProps = $props();
  const status = untrack(() => owner.state);
  const suggestion = $derived(room.suggestions[index]);
  const busy = $derived(
    $status.phase === "pending" || $status.phase === "unconfirmed",
  );
  let active = true;
  function act(accept: boolean, shown: Suggestion) {
    if (!active || busy || !suggestion || !room.members.includes(room.me))
      return;
    const expected = suggestionIdentity(shown);
    if (suggestionIdentity(room.suggestions[index]!) !== expected) return;
    void owner.run({ t: "suggestion", i: index, accept, expected: shown });
  }
  onDestroy(() => {
    active = false;
  });
</script>

{#if suggestion}{#key suggestionIdentity(suggestion)}<Snapshot
      value={suggestion}
      >{#snippet children(shown)}
        <article
          data-vb-native
          data-native-suggestion
          class="mx-auto w-full max-w-2xl space-y-4 p-6 font-sans text-sm leading-6 text-foreground"
        >
          <p class="m-0 text-xs text-muted-foreground">
            ✦ {vb.t("O @vibe sugere um épico")}
          </p>
          <h3 class="m-0 text-base leading-6 font-semibold">
            {suggestion.title}
          </h3>
          <p class="m-0">
            {suggestion.why ||
              vb.t(
                "Ele viu isso na conversa e acha que vale virar um épico, com as tarefas abaixo.",
              )}
          </p>
          {#if suggestion.tasks.length}<h4
              class="m-0 text-sm leading-5 font-semibold"
            >
              {vb.t("Tarefas propostas")}
            </h4>
            <ul class="m-0 list-disc space-y-1 pl-5">
              {#each suggestion.tasks as task}<li>{task}</li>{/each}
            </ul>{/if}
          <div class="flex flex-wrap gap-2">
            <Button
              disabled={busy}
              onclick={(event) => {
                if (event.currentTarget.isConnected) act(true, shown);
              }}>{vb.t("Pedir pro meu agent")}</Button
            ><Button
              variant="ghost"
              disabled={busy}
              onclick={(event) => {
                if (event.currentTarget.isConnected) act(false, shown);
              }}>{vb.t("Descartar")}</Button
            >
          </div>
          <p class="m-0 text-muted-foreground">
            {vb.t(
              "Vira um pedido seu na sala: seu agent confere se ainda faz sentido, ajusta o doc e as tarefas e cria o épico.",
            )}
          </p>
          <MutationStatus {owner} t={vb.t} />
        </article>{/snippet}</Snapshot
    >{/key}{/if}
