<script lang="ts">
  import { client } from "../../lib/client/api";
  import { ReadReceiptsResult } from "../../../shared/schemas";
  import { untrack } from "svelte";
  import Switch from "../../lib/studio/Switch.svelte";

  /**
   * Settings → Account: read receipts in DMs, on by default. Reciprocal, like
   * WhatsApp: off, the other person does not see that you read, and you do not
   * see that they did. Rooms always show them, and agents' reads stay. The
   * server is what hides them (src/book.ts receiptsFor); this only saves it.
   */
  let {
    on: initial,
    lang,
    save = async (wanted: boolean) => {
      const r = await client("/").api.me["read-receipts"].$post({
        json: { on: wanted },
      });
      const v = ReadReceiptsResult.safeParse(await r.json());
      return r.ok && v.success ? v.data.on : null;
    },
  }: {
    on: boolean;
    lang: "pt" | "en";
    /** Saves the choice; the saved value, or null when it failed (the switch goes back). */
    save?: (on: boolean) => Promise<boolean | null>;
  } = $props();
  let on = $state(untrack(() => initial)),
    busy = $state(false),
    failed = $state(false);
  const en = $derived(lang === "en");
  async function set(wanted: boolean) {
    const before = on;
    on = wanted;
    busy = true;
    failed = false;
    try {
      const saved = await save(wanted);
      if (saved === null) {
        on = before;
        failed = true;
      } else on = saved;
    } catch {
      on = before;
      failed = true;
    } finally {
      busy = false;
    }
  }
</script>

<!-- Not a <label>: a label around the switch button turns one click into two (on, then off again; #3638). -->
<div
  data-read-receipts-setting
  class="flex min-h-14 items-center justify-between gap-4 px-4 py-3"
>
  <span class="flex min-w-0 flex-col gap-0.5">
    <span id="settings-read-receipts"
      >{en ? "Read receipts" : "Confirmação de leitura"}</span
    >
    <span class="text-xs leading-4 text-muted-foreground"
      >{en
        ? "In DMs, turned off, you don't see who read and they don't see that you did. Rooms always show it."
        : "Nas DMs, desligada, você não vê quem leu e ninguém vê que você leu. Nas salas aparece sempre."}</span
    >
    {#if failed}<span role="alert" class="text-xs text-destructive"
        >{en
          ? "Could not save. Try again."
          : "Não deu para salvar. Tente de novo."}</span
      >{/if}
  </span>
  <Switch
    checked={on}
    disabled={busy}
    onCheckedChange={(v) => void set(v)}
    aria-labelledby="settings-read-receipts"
  />
</div>
