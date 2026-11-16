// @room: a person's @room/@sala/@todos mentions everyone but the author; agents' don't. Run: bun scripts/mention-check.ts
import { mentioned } from "../src/mentionmail";
const m = ["a@x.co", "bia@x.co", "caio@x.co"], n = { "bia@x.co": "Bia" };
const eq = (a: unknown, b: unknown) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${JSON.stringify(a)} != ${JSON.stringify(b)}`); };
eq(mentioned("aviso @room: deploy às 18h", m, n, "a@x.co", true), ["bia@x.co", "caio@x.co"]);
eq(mentioned("@Sala olha isso", m, n, "a@x.co", true), ["bia@x.co", "caio@x.co"]);
eq(mentioned("aviso @room", m, n, "a@x.co", false), []);
eq(mentioned("oi @bia", m, n, "a@x.co", true), ["bia@x.co"]);
eq(mentioned("email room@x.co", m, n, "a@x.co", true), []);
console.log("mention-check ok");
