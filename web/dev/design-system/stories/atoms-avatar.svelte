<script lang="ts" module>
  export const layouts = { organization: "padded" };
</script>

<script lang="ts">
  import Avatar from "../../../lib/studio/Avatar.svelte";
  import AvatarSkeleton from "../../../lib/studio/AvatarSkeleton.svelte";
  import Matrix from "../Matrix.svelte";

  let { story }: { story: string } = $props();

  const LOGO =
    "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'><rect width='40' height='40' fill='white'/><circle cx='20' cy='20' r='9' fill='%2307401a'/></svg>";
  const ORGANIZATION_ROWS = ["xs", "sm"] as const;
</script>

<!-- Studio's root line height, which the parity page does not inherit. -->
<div class="leading-[1.5]">
  {#if story === "default"}
    <Avatar fallback="Ana Souza" shape="square" size="base" muted={false} />
  {:else if story === "shapes"}
    <div class="flex items-center gap-4">
      <Avatar shape="circle" fallback="Ana Souza" />
      <Avatar shape="square" fallback="Acme Inc" />
    </div>
  {:else if story === "sizes"}
    <div class="flex items-end gap-3">
      <Avatar size="3xs" fallback="Ana Souza" />
      <Avatar size="2xs" fallback="Ana Souza" />
      <Avatar size="xs" fallback="Ana Souza" />
      <Avatar size="sm" fallback="Ana Souza" />
      <Avatar size="md" fallback="Ana Souza" />
      <Avatar size="md" tone="solid" fallback="Casa Aurora" />
      <Avatar size="base" fallback="Ana Souza" />
      <Avatar size="lg" fallback="Ana Souza" />
      <Avatar size="xl" fallback="Ana Souza" />
      <Avatar size="2xl" fallback="Ana Souza" />
    </div>
  {:else if story === "fallback-colors"}
    <div class="flex items-center gap-3">
      <Avatar shape="circle" fallback="Ana Souza" />
      <Avatar shape="circle" fallback="Carla Mendes" />
      <Avatar shape="circle" fallback="Joana Pires" />
      <Avatar shape="circle" fallback="Bruno Lima" />
    </div>
  {:else if story === "muted"}
    <Avatar fallback="Deleted user" shape="square" size="base" muted />
  {:else if story === "skeleton"}
    <div class="flex items-center gap-3">
      <AvatarSkeleton shape="circle" size="base" />
      <AvatarSkeleton shape="square" size="base" />
      <AvatarSkeleton shape="square" size="lg" />
    </div>
  {:else if story === "with-image"}
    <div class="flex items-center gap-3">
      <Avatar url={LOGO} fallback="Acme" />
      <Avatar url="icon://user" fallback="Guest" shape="circle" />
    </div>
  {:else if story === "organization"}
    <Matrix
      columns={["Logo", "No logo", "Selected"]}
      rows={ORGANIZATION_ROWS}
      labels={{ xs: "24", sm: "32" }}
    >
      {#snippet cell(size, index)}
        {#if index === 0}
          <Avatar {size} url={LOGO} fallback="Casa Aurora" />
        {:else if index === 1}
          <Avatar {size} fallback="Casa Aurora" muted />
        {:else}
          <Avatar {size} url={LOGO} fallback="Casa Aurora" selected />
        {/if}
      {/snippet}
    </Matrix>
  {/if}
</div>
