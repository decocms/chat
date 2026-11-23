import { expect, test } from "bun:test";
import { sendInviteEmail } from "../src/invite-mail";
import type { Env } from "../src/index";

/** A fake Env: D1 answers `books` and `users` lookups, EMAIL records each send, LOGIN_LIMIT allows `budget` sends. */
function fixture(o: { lang?: string | null; budget?: number; dev?: boolean } = {}) {
  const sent: { to: string; subject: string; text: string; html: string }[] = [];
  let budget = o.budget ?? 5;
  const env = {
    SESSION_SECRET: "invite-mail-test",
    DEV_EMAIL: o.dev ? "1" : undefined,
    DB: {
      prepare: (sql: string) => ({
        bind: () => ({
          async first() {
            if (sql.includes("FROM books")) return { title: "Projeto X" };
            if (sql.includes("FROM users")) return o.lang === undefined ? null : { lang: o.lang };
            return null;
          },
        }),
      }),
    },
    EMAIL: { send: async (m: (typeof sent)[number]) => void sent.push(m) },
    LOGIN_LIMIT: { limit: async () => ({ success: budget-- > 0 }) },
  } as unknown as Env;
  const pending: Promise<unknown>[] = [];
  const ctx = { waitUntil: (p: Promise<unknown>) => void pending.push(p) };
  return { env, ctx, sent, flush: () => Promise.all(pending) };
}

const base = { origin: "https://chat.test", inviter: "ana@team.test", who: "new@else.test" };

test("someone not on deco.chat who gets a message request gets an invite email, without the message's text (Gimenes #4195)", async () => {
  const f = fixture();
  expect(await sendInviteEmail(f.env, f.ctx, { ...base, lang: "pt" })).toBe(true);
  await f.flush();
  expect(f.sent).toHaveLength(1);
  const [mail] = f.sent;
  expect(mail!.to).toBe("new@else.test");
  expect(mail!.subject).toBe("ana quer conversar com você no deco.chat");
  expect(mail!.text).toContain("https://chat.test/login");
  expect(mail!.html).toContain("Ler a mensagem");
});

test("a room invite keeps its room title and magic link, in the inviter's language when the invitee has none", async () => {
  const f = fixture();
  await sendInviteEmail(f.env, f.ctx, { ...base, lang: "en", room: { id: "abc123" } });
  await f.flush();
  expect(f.sent[0]!.subject).toBe('ana invited you to the room "Projeto X"');
  expect(f.sent[0]!.text).toContain("https://chat.test/auth/invite?t=");
  expect(f.sent[0]!.html).toContain("See the invite");
});

test("the invite email uses the invitee's own language, shares one budget per inviter, and is skipped in dev", async () => {
  const pt = fixture({ lang: "pt" });
  await sendInviteEmail(pt.env, pt.ctx, { ...base, lang: "en", room: { id: "abc", joined: true } });
  await pt.flush();
  expect(pt.sent[0]!.html).toContain("Abrir a sala");

  const limited = fixture({ budget: 1 });
  expect(await sendInviteEmail(limited.env, limited.ctx, base)).toBe(true);
  expect(await sendInviteEmail(limited.env, limited.ctx, { ...base, room: { id: "abc" } })).toBe(false);
  await limited.flush();
  expect(limited.sent).toHaveLength(1);

  const dev = fixture({ dev: true });
  expect(await sendInviteEmail(dev.env, dev.ctx, base)).toBe(false);
  await dev.flush();
  expect(dev.sent).toHaveLength(0);
});
