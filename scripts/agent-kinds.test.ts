// The agent kinds a machine reports (shared/agentKinds.ts): only known kinds, versions cut to their number.
import { expect, test } from "bun:test";
import { agentVersion, machineKinds } from "../shared/agentKinds";

test("a version is cut to its number, from what each CLI prints", () => {
  expect(agentVersion("2.1.332 (Claude Code)")).toBe("2.1.332");
  expect(agentVersion("codex-cli 0.170.0")).toBe("0.170.0");
  expect(agentVersion("1.5.10")).toBe("1.5.10");
  expect(agentVersion("opencode v2.3.0")).toBe("2.3.0");
  expect(agentVersion("no version here")).toBe("");
});

test("a check-in keeps only known kinds; anything else is not sent", () => {
  expect(
    machineKinds({
      claude: "2.1.332 (Claude Code)",
      codex: "0.170.0",
      opencode: "",
      vim: "9.1",
      agy: 5,
    }),
  ).toEqual({ claude: "2.1.332", codex: "0.170.0", opencode: "" });
  expect(machineKinds({})).toEqual({});
  expect(machineKinds(undefined)).toBeNull();
  expect(machineKinds(["claude"])).toBeNull();
  expect(machineKinds("claude")).toBeNull();
});
