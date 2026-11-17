import assert from "node:assert/strict";
import { test } from "node:test";
import { hasSpeakableText, prepareText } from "./text.ts";

test("멘션·채널·이모지·타임스탬프 마크업을 걷어 낸다", () => {
  const raw = "<@123> <@!456> <@&789> 안녕 <#111> <:smile:222> <a:wave:333> <t:1700000000:R> <t:1700000000> 반가워";
  assert.equal(prepareText(raw, 200), "안녕 반가워");
});

test("공백과 제로폭 문자를 정리한다", () => {
  assert.equal(prepareText("  안녕​하세요 \n\n  여러분  ", 200), "안녕하세요 여러분");
});

test("maxChars 까지만 남긴다", () => {
  assert.equal(prepareText("가나다라마바사", 3), "가나다");
});

test("이모지를 중간에서 자르지 않는다", () => {
  assert.equal(prepareText("가😀나", 2), "가😀");
});

test("글자나 숫자가 있어야 읽을 수 있다", () => {
  assert.equal(hasSpeakableText("안녕"), true);
  assert.equal(hasSpeakableText("123"), true);
  assert.equal(hasSpeakableText("... !? ㅋ"), true);
  assert.equal(hasSpeakableText("... !?"), false);
  assert.equal(hasSpeakableText(""), false);
});
