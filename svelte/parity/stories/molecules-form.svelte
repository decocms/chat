<script lang="ts">
  import Button from "../../lib/studio/Button.svelte";
  import FormControl from "../../lib/studio/FormControl.svelte";
  import FormDescription from "../../lib/studio/FormDescription.svelte";
  import FormField from "../../lib/studio/FormField.svelte";
  import FormItem from "../../lib/studio/FormItem.svelte";
  import FormLabel from "../../lib/studio/FormLabel.svelte";
  import FormMessage from "../../lib/studio/FormMessage.svelte";
  import Input from "../../lib/studio/Input.svelte";
  import Switch from "../../lib/studio/Switch.svelte";
  import Textarea from "../../lib/studio/Textarea.svelte";

  let { story }: { story: string } = $props();

  // The profile form validates on submit, then on every change, as react-hook-form does by default.
  let profile = $state({
    name: "Ana Souza",
    email: "ana@example.com",
    bio: "",
    notifications: true,
  });
  let profileSubmitted = $state(false);
  const nameError = $derived(
    profileSubmitted && profile.name === "" ? "Name is required." : undefined,
  );
  const emailError = $derived(
    !profileSubmitted
      ? undefined
      : profile.email === ""
        ? "Email is required."
        : /^\S+@\S+$/.test(profile.email)
          ? undefined
          : "Enter a valid email address.",
  );

  // The slug form validates from the first change (`mode: "onChange"`).
  let slug = $state("");
  let slugChecked = $state(false);
  const slugError = $derived(
    !slugChecked
      ? undefined
      : slug === ""
        ? "A slug is required."
        : /^[a-z0-9-]+$/.test(slug)
          ? undefined
          : "Slugs can only contain lowercase letters, numbers, and dashes.",
  );
</script>

{#if story === "default"}
  <form
    class="tw:grid tw:w-96 tw:gap-6"
    onsubmit={(event) => {
      event.preventDefault();
      profileSubmitted = true;
    }}
  >
    <FormField name="name" error={nameError}>
      <FormItem>
        <FormLabel>Name</FormLabel>
        <FormControl>
          {#snippet child({ props })}
            <Input
              {...props}
              placeholder="Your full name"
              name="name"
              bind:value={profile.name}
            />
          {/snippet}
        </FormControl>
        <FormDescription>
          Shown to other members of your organization.
        </FormDescription>
        <FormMessage />
      </FormItem>
    </FormField>
    <FormField name="email" error={emailError}>
      <FormItem>
        <FormLabel>Email</FormLabel>
        <FormControl>
          {#snippet child({ props })}
            <Input
              {...props}
              type="email"
              placeholder="you@company.com"
              name="email"
              bind:value={profile.email}
            />
          {/snippet}
        </FormControl>
        <FormMessage />
      </FormItem>
    </FormField>
    <FormField name="bio">
      <FormItem>
        <FormLabel>Bio</FormLabel>
        <FormControl>
          {#snippet child({ props })}
            <Textarea
              {...props}
              placeholder="A short description about yourself."
              name="bio"
              bind:value={profile.bio}
            />
          {/snippet}
        </FormControl>
        <FormMessage />
      </FormItem>
    </FormField>
    <FormField name="notifications">
      <FormItem
        class="tw:flex tw:flex-row tw:items-center tw:justify-between tw:gap-4"
      >
        <div class="tw:grid tw:gap-1">
          <FormLabel>Email notifications</FormLabel>
          <FormDescription>
            Receive updates about activity in your projects.
          </FormDescription>
        </div>
        <FormControl>
          {#snippet child({ props })}
            <Switch {...props} bind:checked={profile.notifications} />
          {/snippet}
        </FormControl>
      </FormItem>
    </FormField>
    <Button type="submit" class="tw:justify-self-start">Save changes</Button>
  </form>
{:else if story === "with-validation"}
  <form
    class="tw:grid tw:w-96 tw:gap-6"
    onsubmit={(event) => {
      event.preventDefault();
      slugChecked = true;
    }}
  >
    <FormField name="slug" error={slugError}>
      <FormItem>
        <FormLabel>Organization slug</FormLabel>
        <FormControl>
          {#snippet child({ props })}
            <Input
              {...props}
              placeholder="acme-inc"
              name="slug"
              bind:value={slug}
              oninput={() => (slugChecked = true)}
            />
          {/snippet}
        </FormControl>
        <FormDescription>
          Type an uppercase letter to see the error state.
        </FormDescription>
        <FormMessage />
      </FormItem>
    </FormField>
    <Button type="submit" class="tw:justify-self-start">
      Create organization
    </Button>
  </form>
{/if}
