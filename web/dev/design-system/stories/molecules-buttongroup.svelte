<script lang="ts">
  import Button from "../../../lib/studio/Button.svelte";
  import ButtonGroup from "../../../lib/studio/ButtonGroup.svelte";
  import ButtonGroupSeparator from "../../../lib/studio/ButtonGroupSeparator.svelte";
  import ButtonGroupText from "../../../lib/studio/ButtonGroupText.svelte";
  import Icon from "../../../lib/studio/Icon.svelte";
  import { ChevronDown, Copy01, SearchMd } from "../../../lib/studio/icons";
  import Input from "../../../lib/studio/Input.svelte";

  let { story }: { story: string } = $props();
</script>

{#if story === "default"}
  <ButtonGroup orientation="horizontal">
    <Button variant="outline">Day</Button>
    <Button variant="outline">Week</Button>
    <Button variant="outline">Month</Button>
  </ButtonGroup>
{:else if story === "vertical"}
  <ButtonGroup orientation="vertical">
    <Button variant="outline">Move up</Button>
    <Button variant="outline">Move down</Button>
    <Button variant="outline">Remove</Button>
  </ButtonGroup>
{:else if story === "with-separator"}
  <ButtonGroup>
    <Button variant="outline">Save changes</Button>
    <ButtonGroupSeparator />
    <Button variant="outline" size="icon" aria-label="More save options">
      <Icon icon={ChevronDown} />
    </Button>
  </ButtonGroup>
{:else if story === "with-text"}
  <ButtonGroup>
    <ButtonGroupText>https://</ButtonGroupText>
    <Input placeholder="acme.deco.page" class="w-56" />
    <Button variant="outline" aria-label="Copy URL">
      <Icon icon={Copy01} /> Copy
    </Button>
  </ButtonGroup>
{:else if story === "with-input"}
  <ButtonGroup>
    <Input placeholder="Search members..." class="w-64" />
    <Button variant="outline" aria-label="Search">
      <Icon icon={SearchMd} />
    </Button>
  </ButtonGroup>
{/if}
