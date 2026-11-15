import { Hono } from "hono";
import { r2FileResponse } from "../src/r2FileResponse";
// Header-policy fixtures, not a real browser HTTP-cache or R2 integration gate.
import { expect, mock, test } from "bun:test";
mock.module("cloudflare:workers", () => ({
  DurableObject: class {},
  WorkerEntrypoint: class {},
  env: {},
}));
const { FILE_TYPES, fileHeaders } = await import("../src/rooms");

test("every supported private file type varies by the actual account cookie", () => {
  for (const type of [...FILE_TYPES, "unknown/unsupported"]) {
    const headers = new Headers(fileHeaders(type, "private file"));
    expect(headers.get("vary")).toBe("Cookie");
    expect(headers.get("cache-control")).toBe("private, max-age=86400");
    expect(headers.get("etag")).toBeNull();
    expect(headers.get("last-modified")).toBeNull();
  }
});

test("account cache partition leaves MIME, disposition and HTML sandbox intact", () => {
  const headers = new Headers(
    fileHeaders("text/html", 'ação"\r\n<script>.html'),
  );
  expect(headers.get("content-type")).toBe("text/html; charset=utf-8");
  expect(headers.get("content-disposition")).toBe(
    "inline; filename*=UTF-8''a%C3%A7%C3%A3o%22%0D%0A%3Cscript%3E.html",
  );
  expect(headers.get("x-content-type-options")).toBe("nosniff");
  expect(headers.get("content-security-policy")).toContain(
    "sandbox allow-scripts;",
  );
  expect(headers.get("content-security-policy")).not.toContain(
    "allow-same-origin",
  );
  expect(headers.get("content-security-policy")).toContain(
    "connect-src 'none'",
  );
  expect(headers.get("referrer-policy")).toBe("no-referrer");
  expect(headers.get("cross-origin-opener-policy")).toBe("same-origin");
});

test("plain text and unknown types retain non-executable serving policies", () => {
  expect(fileHeaders("text/markdown", "notes.md")["content-type"]).toBe(
    "text/plain; charset=utf-8",
  );
  const headers = fileHeaders("image/svg+xml", "unsafe.svg");
  expect(headers["content-type"]).toBe("application/octet-stream");
  expect(headers["content-security-policy"]).toBe(
    "sandbox; default-src 'none'; img-src 'self'; style-src 'unsafe-inline'",
  );
  expect(headers.vary).toBe("Cookie");
});

// Actual production response constructor through Hono; R2 result bodies are
// explicit fixture inputs, not a claim that this test implements R2 parsing.
function fileResponse(
  range: R2Range | undefined,
  content = "0123456789",
  body = true,
) {
  const app = new Hono();
  app.get("/file", (c) => {
    const headers = new Headers(fileHeaders("audio/webm", "voice.webm"));
    headers.set("accept-ranges", "bytes");
    const object = body
      ? { size: 10, range, body: new Blob([content]).stream() }
      : { size: 10, range };
    return r2FileResponse(object, !!c.req.header("range"), headers);
  });
  return app;
}

test("actual file response preserves full, ignored-range and bodyless SDK responses", async () => {
  for (const range of [undefined, "bytes=0-0"]) {
    const response = await fileResponse(undefined).request("/file", {
      headers: range ? { range } : {},
    });
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("0123456789");
    expect(response.headers.get("content-range")).toBe(null);
    expect(response.headers.get("accept-ranges")).toBe("bytes");
    expect(response.headers.get("vary")).toBe("Cookie");
  }
  const metadata = await fileResponse(
    { offset: 0, length: 1 },
    "",
    false,
  ).request("/file", { headers: { range: "bytes=0-0" } });
  expect(metadata.status).toBe(200);
  expect(await metadata.text()).toBe("");
  expect(metadata.headers.get("content-range")).toBe(null);
});

test("actual SDK range union retains suffix, offset, bounded and Safari206 byte-probe semantics", async () => {
  const cases: {
    range: R2Range;
    header: string;
    content: string;
    expected: string;
  }[] = [
    {
      range: { suffix: 3 },
      header: "bytes=-3",
      content: "789",
      expected: "bytes 7-9/10",
    },
    {
      range: { suffix: 20 },
      header: "bytes=-20",
      content: "0123456789",
      expected: "bytes 0-9/10",
    },
    {
      range: { offset: 3 },
      header: "bytes=3-",
      content: "3456789",
      expected: "bytes 3-9/10",
    },
    {
      range: { offset: 2, length: 3 },
      header: "bytes=2-4",
      content: "234",
      expected: "bytes 2-4/10",
    },
    {
      range: { length: 3 },
      header: "bytes=0-2",
      content: "012",
      expected: "bytes 0-2/10",
    },
    {
      range: { offset: 0, length: 1 },
      header: "bytes=0-0",
      content: "0",
      expected: "bytes 0-0/10",
    },
  ];
  for (const value of cases) {
    const response = await fileResponse(value.range, value.content).request(
      "/file",
      { headers: { range: value.header } },
    );
    expect(response.status).toBe(206);
    expect(response.headers.get("content-range")).toBe(value.expected);
    expect(response.headers.get("content-length")).toBe(
      String(value.content.length),
    );
    expect(await response.text()).toBe(value.content);
  }
});

test("actual Hono HEAD preserves full/range headers without a response body", async () => {
  for (const ranged of [false, true]) {
    const response = await fileResponse(
      ranged ? { offset: 0, length: 1 } : undefined,
      ranged ? "0" : "0123456789",
    ).request("/file", {
      method: "HEAD",
      headers: ranged ? { range: "bytes=0-0" } : {},
    });
    expect(response.status).toBe(ranged ? 206 : 200);
    expect(await response.text()).toBe("");
    expect(response.headers.get("content-range")).toBe(
      ranged ? "bytes 0-0/10" : null,
    );
    expect(response.headers.get("content-length")).toBe(ranged ? "1" : null);
  }
});

test("R2 range dictionaries with a present undefined suffix use their offset/length values", async () => {
  // Structural SDK unions do not forbid extra optional dictionary fields.
  // Miniflare's own public R2 handler also tests suffix VALUE, not presence.
  const range = { offset: 0, length: 1, suffix: undefined };
  const response = await fileResponse(range, "0").request("/file", {
    headers: { range: "bytes=0-0" },
  });
  expect(response.status).toBe(206);
  expect(response.headers.get("content-range")).toBe("bytes 0-0/10");
  expect(response.headers.get("content-length")).toBe("1");
  expect(await response.text()).toBe("0");
});
