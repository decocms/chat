<script lang="ts" module>
  export const layouts = { states: "padded" };
</script>

<script lang="ts">
  import Label from "../../lib/studio/Label.svelte";
  import TagsInput from "../../lib/studio/TagsInput.svelte";
  import Matrix from "../Matrix.svelte";

  let { story }: { story: string } = $props();

  const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  const ROWS = ["TagsInput"] as const;
  let emails = $state(["ana@acme.com", "bruno@acme"]);
</script>

{#if story === "playground"}
  <div class="tw:w-96">
    <TagsInput
      placeholder="Add a keyword"
      value={["checkout", "black friday"]}
    />
  </div>
{:else if story === "emails"}
  <div class="tw:grid tw:w-96 tw:gap-2">
    <Label for="invite">Invite by email</Label>
    <TagsInput
      id="invite"
      bind:value={emails}
      validate={isEmail}
      placeholder="name@company.com"
    />
    <p
      class="tw:text-[0.75rem] tw:leading-4 tw:text-pretty tw:text-muted-foreground tw:tabular-nums"
    >
      {emails.filter((e) => !isEmail(e)).length} address needs fixing
    </p>
  </div>
{:else if story === "states"}
  <Matrix
    columns={["Empty", "With tags", "Invalid tag", "Disabled"]}
    rows={ROWS}
  >
    {#snippet cell(_row, index)}
      <div class="tw:w-56">
        {#if index === 0}
          <TagsInput placeholder="Add a keyword" />
        {:else if index === 1}
          <TagsInput value={["seo", "checkout"]} />
        {:else if index === 2}
          <TagsInput value={["ana@acme"]} validate={isEmail} />
        {:else}
          <TagsInput value={["seo"]} disabled />
        {/if}
      </div>
    {/snippet}
  </Matrix>
{/if}
