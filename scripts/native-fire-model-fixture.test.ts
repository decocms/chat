import { expect, test } from "bun:test";
import { generateText, Output } from "ai";
import { z } from "zod";
import { createFireModelProvider, fireProvider } from "../src/fire-provider";
import { FIRE_FIXTURE_MODEL, FIRE_HTML, FIRE_SPEECH, fireFixtureCard } from "./native-fire-fixture-data";
import { fireModelAnswer, startFireModelFixture } from "./native-fire-model-fixture";
import { reviewModelAnswer, REVIEW_FIXTURE_MODEL } from "./native-review-model-fixture";
import { EMBED_QUESTIONS } from "../src/embed-review-contract";

test("the external Fire protocol serves real SDK format/card/file calls only for known speech", async () => {
  const fixture = await startFireModelFixture();
  try {
    const model = createFireModelProvider(fireProvider({DEV_EMAIL:"dev@example.test", FIRE_API:fixture.url}), "SYNTHETIC_NEVER_FORWARD")(FIRE_FIXTURE_MODEL);
    const format = await generateText({model, temperature:0, maxRetries:0,
      system:"Choose the format for what a person is asking for, by voice. Fixture",
      prompt:`NEW SPEECH:\n${FIRE_SPEECH.first}`,
      output:Output.object({schema:z.object({format:z.enum(["card","html"])})})});
    expect(format.output).toEqual({format:"card"});
    const card = await generateText({model, temperature:0.2, maxRetries:0,
      system:"You build one native chat card live while a person talks: Fixture",
      prompt:`NEW SPEECH:\n${FIRE_SPEECH.update}`,
      output:Output.object({schema:z.object({card:z.string(),title:z.string()})})});
    expect(card.output.card).toBe(JSON.stringify(fireFixtureCard(2)));
    const file = await generateText({model, temperature:0.2, maxRetries:0,
      system:"You edit one file live while a person talks. Fixture",
      prompt:`NEW SPEECH:\n${FIRE_SPEECH.htmlUpdate}`});
    expect(file.text).toBe(FIRE_HTML.second);
    expect(fixture.evidence).toMatchObject({format:1,card:1,file:1,invalid:0,authorizationRejected:0});
    for (const payload of [ {}, {model:FIRE_FIXTURE_MODEL,messages:[]},
      {model:FIRE_FIXTURE_MODEL,temperature:0.2,messages:[{role:"system",content:"You edit one file live while a person talks."},{role:"user",content:"NEW SPEECH:\nunknown"}]}])
      expect(fireModelAnswer(payload)).toBeNull();
    const rejected = await fetch(fixture.url,{method:"POST",headers:{"content-type":"application/json",authorization:"SYNTHETIC_HEADER"},body:"{}"});
    expect(rejected.status).toBe(400);
    expect(fixture.evidence.authorizationRejected).toBe(1);
  } finally { await fixture.close(); }
});

test("Fire embed judgments remain exact synthetic HTML allowlist, not a review bypass", () => {
  const answer = (html:string) => reviewModelAnswer({model:REVIEW_FIXTURE_MODEL,state:{html},questions:{
    credentials:{type:"noul",instructions:EMBED_QUESTIONS.credentials},
    impersonation:{type:"noul",instructions:EMBED_QUESTIONS.impersonation},
    manipulation:{type:"noul",instructions:EMBED_QUESTIONS.manipulation},
  }},"http://127.0.0.1:8797");
  expect(answer(FIRE_HTML.first)?.verdict).toBe("allow");
  expect(answer(FIRE_HTML.second)?.verdict).toBe("allow");
  expect(answer(FIRE_HTML.first.replace("</body>","<script>unknown()</script></body>"))).toBeNull();
  expect(answer("<html>arbitrary unknown document</html>")).toBeNull();
});
