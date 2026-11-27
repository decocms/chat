<script lang="ts">
  import { TINTS } from "../../../shared/schemas";
  import { cn } from "../../lib/studio/utils";
  import { createApplicationCopy } from "../application/copy";
  import type { RoomTint } from "../home/api";
  import type { HomeLanguage } from "../home/copy";
  import { tintDot, tintName } from "./tints";
  /** The color swatches of "Editar sala…" and "Configurações da pasta": a click picks one (Gimenes #6163). */
  let {
    value,
    lang,
    disabled = false,
    onpick,
  }: {
    value: RoomTint;
    lang: HomeLanguage;
    disabled?: boolean;
    onpick: (tint: RoomTint) => void;
  } = $props();
  const t = $derived(createApplicationCopy(lang));
</script>

<div class="flex flex-wrap gap-2">
  {#each [null, ...TINTS] as tint (tint ?? "none")}
    {@const on = value === tint}
    <button
      type="button"
      data-tint={tint ?? "none"}
      aria-label={t(tintName(tint))}
      aria-pressed={on}
      title={t(tintName(tint))}
      {disabled}
      class={cn(
        "grid size-8 cursor-pointer place-items-center rounded-full border-0 bg-transparent p-0 outline-offset-2 disabled:cursor-not-allowed",
        on && "outline-2 outline-solid outline-foreground",
      )}
      onclick={() => onpick(tint)}
      ><span class={cn("size-6 rounded-full", tintDot(tint))}></span></button
    >
  {/each}
</div>
