<script lang="ts" module>
  export const layouts = {
    default: "padded",
    "with-caption": "padded",
    "with-footer": "padded",
    "selected-row": "padded",
  };
</script>

<script lang="ts">
  import Table from "../../lib/studio/Table.svelte";
  import TableBody from "../../lib/studio/TableBody.svelte";
  import TableCaption from "../../lib/studio/TableCaption.svelte";
  import TableCell from "../../lib/studio/TableCell.svelte";
  import TableFooter from "../../lib/studio/TableFooter.svelte";
  import TableHead from "../../lib/studio/TableHead.svelte";
  import TableHeader from "../../lib/studio/TableHeader.svelte";
  import TableRow from "../../lib/studio/TableRow.svelte";

  let { story }: { story: string } = $props();

  const members = [
    {
      name: "Ana Souza",
      email: "ana@acme.com",
      role: "Owner",
      status: "Active",
    },
    {
      name: "Bruno Lima",
      email: "bruno@acme.com",
      role: "Admin",
      status: "Active",
    },
    {
      name: "Carla Mendes",
      email: "carla@acme.com",
      role: "Member",
      status: "Invited",
    },
    {
      name: "Diego Santos",
      email: "diego@acme.com",
      role: "Member",
      status: "Active",
    },
    {
      name: "Elisa Rocha",
      email: "elisa@acme.com",
      role: "Viewer",
      status: "Suspended",
    },
  ];
</script>

{#if story === "default"}
  <div class="tw:w-[640px]">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Email</TableHead>
          <TableHead>Role</TableHead>
          <TableHead class="tw:text-right">Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {#each members as member (member.email)}
          <TableRow>
            <TableCell class="tw:font-medium">{member.name}</TableCell>
            <TableCell class="tw:text-muted-foreground"
              >{member.email}</TableCell
            >
            <TableCell>{member.role}</TableCell>
            <TableCell class="tw:text-right">{member.status}</TableCell>
          </TableRow>
        {/each}
      </TableBody>
    </Table>
  </div>
{:else if story === "with-caption"}
  <div class="tw:w-[640px]">
    <Table>
      <TableCaption>Members of the Acme Inc organization.</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Role</TableHead>
          <TableHead class="tw:text-right">Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {#each members.slice(0, 3) as member (member.email)}
          <TableRow>
            <TableCell class="tw:font-medium">{member.name}</TableCell>
            <TableCell>{member.role}</TableCell>
            <TableCell class="tw:text-right">{member.status}</TableCell>
          </TableRow>
        {/each}
      </TableBody>
    </Table>
  </div>
{:else if story === "with-footer"}
  <div class="tw:w-[640px]">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Connection</TableHead>
          <TableHead>Tool calls</TableHead>
          <TableHead class="tw:text-right">Cost</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell class="tw:font-medium">Slack</TableCell>
          <TableCell>1,204</TableCell>
          <TableCell class="tw:text-right">$12.04</TableCell>
        </TableRow>
        <TableRow>
          <TableCell class="tw:font-medium">GitHub</TableCell>
          <TableCell>876</TableCell>
          <TableCell class="tw:text-right">$8.76</TableCell>
        </TableRow>
        <TableRow>
          <TableCell class="tw:font-medium">Postgres</TableCell>
          <TableCell>2,310</TableCell>
          <TableCell class="tw:text-right">$23.10</TableCell>
        </TableRow>
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell colspan={2}>Total</TableCell>
          <TableCell class="tw:text-right">$43.90</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  </div>
{:else if story === "selected-row"}
  <div class="tw:w-[640px]">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Role</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell class="tw:font-medium">Ana Souza</TableCell>
          <TableCell>Owner</TableCell>
        </TableRow>
        <TableRow data-state="selected">
          <TableCell class="tw:font-medium">Bruno Lima</TableCell>
          <TableCell>Admin</TableCell>
        </TableRow>
        <TableRow>
          <TableCell class="tw:font-medium">Carla Mendes</TableCell>
          <TableCell>Member</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </div>
{/if}
