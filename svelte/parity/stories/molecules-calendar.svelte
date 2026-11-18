<script lang="ts">
  import {
    type DateValue,
    getLocalTimeZone,
    today,
  } from "@internationalized/date";
  import Calendar from "../../lib/studio/Calendar.svelte";
  import type { CalendarRange } from "../../lib/studio/calendar";

  let { story }: { story: string } = $props();

  const now = today(getLocalTimeZone());
  let date = $state<DateValue | undefined>(now);
  let range = $state<CalendarRange | undefined>({
    from: now.set({ day: 4 }),
    to: now.set({ day: 12 }),
  });
  let free = $state<DateValue | undefined>();
</script>

<!-- Studio's root line height, which the parity page does not inherit. -->
<div class="leading-[1.5]">
  {#if story === "default"}
    <Calendar
      mode="single"
      bind:selected={date}
      class="rounded-lg border border-border"
    />
  {:else if story === "range"}
    <Calendar
      mode="range"
      bind:selected={range}
      numberOfMonths={2}
      class="rounded-lg border border-border"
    />
  {:else if story === "past-days-disabled"}
    <Calendar
      mode="single"
      bind:selected={free}
      disabled={{ before: now }}
      class="rounded-lg border border-border"
    />
  {/if}
</div>
