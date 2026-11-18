import { expect, test } from "bun:test";
import { findSecret, redactSecrets } from "../src/secrets";

// AWS's and GitHub's documented example keys: shaped like real ones, valid nowhere.
const AKIA = "AKIAIOSFODNN7EXAMPLE";
const AWS_SECRET = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY";
const GHP = "ghp_16C7e42F292c6912E7710c838347Ae178B4a";

test("findSecret catches a key whose body is pushed past its prefix", () => {
  expect(findSecret(`aws_access_key_id\nAKIA\n${AKIA.slice(4)}`)).toBe(
    "chave AWS",
  );
  expect(findSecret(`github_pat (wrapped):\nghp_\n${GHP.slice(4)}`)).toBe(
    "token GitHub",
  );
  expect(findSecret(`ghp_ ${GHP.slice(4)}`)).toBe("token GitHub");
});

test("findSecret catches an AWS secret access key by its name", () => {
  expect(findSecret(`aws_secret_access_key = ${AWS_SECRET}`)).toBe("chave AWS");
  expect(findSecret(`AWS_SECRET_ACCESS_KEY=${AWS_SECRET}`)).toBe("chave AWS");
});

test("findSecret leaves ordinary text alone", () => {
  expect(findSecret("ask- me later about the deploy")).toBeNull();
  expect(findSecret("the AKIA prefix marks AWS access keys")).toBeNull();
});

test("redactSecrets masks every shape findSecret knows", () => {
  const out = redactSecrets(
    [
      `aws_access_key_id = ${AKIA}`,
      `aws_secret_access_key = ${AWS_SECRET}`,
      `github_pat = ${GHP}`,
      "slack = xoxb-1234567890-abcdefghij",
      "sk-ant-oat01-abcdefghijklmnopqrstuvwxyz",
    ].join("\n"),
  );
  for (const s of [AKIA, AWS_SECRET, GHP, "xoxb-1234567890", "sk-ant-oat01"])
    expect(out).not.toContain(s);
  expect(findSecret(out)).toBeNull();
});

test("redactSecrets keeps secret-named env assignments' names", () => {
  expect(redactSecrets(`AWS_SECRET_ACCESS_KEY=${AWS_SECRET}`)).toBe(
    "AWS_SECRET_ACCESS_KEY=[redacted]",
  );
  expect(redactSecrets("CLAUDE_CODE_OAUTH_TOKEN=abc123")).toBe(
    "CLAUDE_CODE_OAUTH_TOKEN=[redacted]",
  );
  expect(redactSecrets("FREESTYLE_API_KEY=abc123")).toBe(
    "FREESTYLE_API_KEY=[redacted]",
  );
  expect(redactSecrets('{"access_token":"abc","name":"x"}')).toBe(
    '{"access_token":"[redacted]","name":"x"}',
  );
});

test("redactSecrets leaves plain command output as it is", () => {
  const log = "READY\n---\ninstalled 42 packages in 3.1s\nexit 0";
  expect(redactSecrets(log)).toBe(log);
});
