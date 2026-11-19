<script lang="ts">
  import Accordion from "../../../lib/studio/Accordion.svelte";
  import AccordionContent from "../../../lib/studio/AccordionContent.svelte";
  import AccordionItem from "../../../lib/studio/AccordionItem.svelte";
  import AccordionTrigger from "../../../lib/studio/AccordionTrigger.svelte";

  let { story }: { story: string } = $props();
</script>

{#if story === "default"}
  <Accordion type="single" collapsible class="w-96">
    <AccordionItem value="connections">
      <AccordionTrigger>What is a connection?</AccordionTrigger>
      <AccordionContent>
        A connection links an MCP server to your workspace so its tools become
        available to your agents and teammates.
      </AccordionContent>
    </AccordionItem>
    <AccordionItem value="permissions">
      <AccordionTrigger>How do permissions work?</AccordionTrigger>
      <AccordionContent>
        Each member gets a role per project. Roles control which tools they can
        run and which connections they can manage.
      </AccordionContent>
    </AccordionItem>
    <AccordionItem value="billing">
      <AccordionTrigger>How is usage billed?</AccordionTrigger>
      <AccordionContent>
        Usage is metered per tool call and aggregated monthly on your
        organization invoice.
      </AccordionContent>
    </AccordionItem>
  </Accordion>
{:else if story === "multiple"}
  <Accordion type="multiple" value={["general", "notifications"]} class="w-96">
    <AccordionItem value="general">
      <AccordionTrigger>General</AccordionTrigger>
      <AccordionContent>
        Organization name, slug, and default project visibility.
      </AccordionContent>
    </AccordionItem>
    <AccordionItem value="notifications">
      <AccordionTrigger>Notifications</AccordionTrigger>
      <AccordionContent>
        Choose where alerts about failed tool calls are delivered.
      </AccordionContent>
    </AccordionItem>
    <AccordionItem value="danger">
      <AccordionTrigger>Danger zone</AccordionTrigger>
      <AccordionContent>
        Delete this organization and all of its projects. This cannot be undone.
      </AccordionContent>
    </AccordionItem>
  </Accordion>
{/if}
