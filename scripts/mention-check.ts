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
// Two Rafaels: @rafael reaches neither; each one's @handle or email reaches only them (shared/mention.ts).
{
  const r = ["leo@x.co", "valls@x.co", "rafael.b@x.co"];
  const names = { "valls@x.co": "Rafael Valls", "rafael.b@x.co": "Rafael B" };
  const handles = { "valls@x.co": "valls", "rafael.b@x.co": "baby" };
  eq(mentioned("oi @rafael", r, names, "leo@x.co", true, handles), []);
  eq(mentioned("@baby e @valls", r, names, "leo@x.co", true, handles), ["valls@x.co", "rafael.b@x.co"]);
  eq(mentioned("@rafael.b", r, names, "leo@x.co", true, handles), ["rafael.b@x.co"]);
}
console.log("mention-check (handles) ok");
