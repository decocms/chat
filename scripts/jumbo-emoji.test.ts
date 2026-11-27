import { describe, expect, test } from "bun:test";
import { jumboEmojiCount } from "../web/features/chat/jumboEmoji";

describe("jumbo emoji", () => {
  test("counts 1 to 3 emoji, with whitespace around or between", () => {
    expect(jumboEmojiCount("🔥")).toBe(1);
    expect(jumboEmojiCount(" 🔥 \n")).toBe(1);
    expect(jumboEmojiCount("🔥🚀")).toBe(2);
    expect(jumboEmojiCount("🔥 🚀 😂")).toBe(3);
  });
  test("four emoji, or emoji with text, are plain text", () => {
    expect(jumboEmojiCount("🔥🚀😂👍")).toBe(0);
    expect(jumboEmojiCount("🔥 nice")).toBe(0);
    expect(jumboEmojiCount("ok 👍")).toBe(0);
    expect(jumboEmojiCount("")).toBe(0);
    expect(jumboEmojiCount("   ")).toBe(0);
    expect(jumboEmojiCount("1")).toBe(0);
    expect(jumboEmojiCount("©")).toBe(0);
    expect(jumboEmojiCount(":)")).toBe(0);
  });
  test("a ZWJ family, a flag and a skin tone are one emoji each", () => {
    expect(jumboEmojiCount("👨‍👩‍👧‍👦")).toBe(1);
    expect(jumboEmojiCount("🇧🇷")).toBe(1);
    expect(jumboEmojiCount("👍🏽")).toBe(1);
    expect(jumboEmojiCount("🧑🏽‍💻")).toBe(1);
    expect(jumboEmojiCount("🏳️‍🌈")).toBe(1);
    expect(jumboEmojiCount("❤️")).toBe(1);
    expect(jumboEmojiCount("🏴󠁧󠁢󠁳󠁣󠁴󠁿")).toBe(1);
    expect(jumboEmojiCount("1️⃣")).toBe(1);
    expect(jumboEmojiCount("👨‍👩‍👧‍👦🇧🇷👍🏽")).toBe(3);
    expect(jumboEmojiCount("👨‍👩‍👧‍👦🇧🇷👍🏽🔥")).toBe(0);
  });
});
