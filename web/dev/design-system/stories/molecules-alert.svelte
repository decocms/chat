<script lang="ts">
  import Alert from "../../../lib/studio/Alert.svelte";
  import AlertDescription from "../../../lib/studio/AlertDescription.svelte";
  import AlertTitle from "../../../lib/studio/AlertTitle.svelte";
  import Icon from "../../../lib/studio/Icon.svelte";

  let { story }: { story: string } = $props();
</script>

{#if story === "default"}
  <Alert variant="default" class="w-96">
    <Icon icon="info-circle" />
    <div>
      <AlertTitle>Connection created</AlertTitle>
      <AlertDescription>
        Your Slack workspace is now available to all projects in this
        organization.
      </AlertDescription>
    </div>
  </Alert>
{:else if story === "variants"}
  <div class="flex w-96 flex-col gap-3">
    <Alert>
      <Icon icon="info-circle" />
      <div>
        <AlertTitle>Heads up</AlertTitle>
        <AlertDescription>
          You can invite up to 25 members on the current plan.
        </AlertDescription>
      </div>
    </Alert>
    <Alert variant="info">
      <Icon icon="info-circle" />
      <div>
        <AlertTitle>Scheduled maintenance</AlertTitle>
        <AlertDescription>
          The API will be briefly unavailable on Sunday at 02:00 UTC.
        </AlertDescription>
      </div>
    </Alert>
    <Alert variant="success">
      <Icon icon="check-circle" />
      <div>
        <AlertTitle>Deployment succeeded</AlertTitle>
        <AlertDescription>
          Version 2.14.0 is now live in production.
        </AlertDescription>
      </div>
    </Alert>
    <Alert variant="warning">
      <Icon icon="alert-triangle" />
      <div>
        <AlertTitle>Token expiring soon</AlertTitle>
        <AlertDescription>
          The GitHub connection token expires in 3 days. Rotate it to avoid
          interruptions.
        </AlertDescription>
      </div>
    </Alert>
    <Alert variant="destructive">
      <Icon icon="alert-circle" />
      <div>
        <AlertTitle>Payment failed</AlertTitle>
        <AlertDescription>
          We could not charge your card ending in 4242. Update your billing
          details to keep your subscription active.
        </AlertDescription>
      </div>
    </Alert>
  </div>
{:else if story === "title-only"}
  <Alert variant="success" class="w-96">
    <Icon icon="check-circle" />
    <AlertTitle>Settings saved</AlertTitle>
  </Alert>
{/if}
