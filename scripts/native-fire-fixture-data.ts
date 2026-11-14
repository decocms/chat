// Synthetic inputs shared by the external model server and its owned browser
// context. None of these constants are production instructions or permissions.
export const FIRE_FIXTURE_MODEL = "fixture/native-fire";
export const FIRE_SPEECH = {
  first: "Native Fire fixture: create metric card one.",
  update: "Native Fire fixture: update metric card two.",
  html: "Native Fire fixture: make an html page one.",
  htmlUpdate: "Native Fire fixture: update html page two.",
  cardAgain: "Native Fire fixture: make a card again.",
} as const;
export const FIRE_HTML = {
  first: '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Native Fire fixture</title></head><body><h1>Native Fire page one</h1><p>Synthetic owned-room protocol fixture.</p></body></html>',
  second: '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Native Fire fixture</title></head><body><h1>Native Fire page two</h1><p>Synthetic owned-room protocol fixture.</p></body></html>',
} as const;
export function fireFixtureCard(version: 1 | 2 | 3) {
  return {
    root: "c",
    elements: {
      c: { type: "Card", props: { title: `Native Fire card ${version}` }, children: ["fields"] },
      fields: { type: "Fields", props: {}, children: ["metric"] },
      metric: { type: "Field", props: { label: "Synthetic metric", value: String(version) } },
    },
  };
}
