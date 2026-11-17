import assert from "node:assert/strict";
import { test } from "node:test";
import { type BotCandidate, chooseBot } from "./pickBot.ts";

const bot = (name: string, connectedChannelId: string | null, canJoin = true): BotCandidate<string> => ({
  bot: name,
  connectedChannelId,
  canJoin,
});

test("이미 그 음성 채널에 있는 봇을 쓴다", () => {
  assert.equal(chooseBot([bot("A", null), bot("B", "vc1")], "vc1"), "B");
});

test("그 채널에 봇이 없으면 쉬고 있는 봇이 들어간다", () => {
  assert.equal(chooseBot([bot("A", "vc1"), bot("B", null)], "vc2"), "B");
  assert.equal(chooseBot([bot("A", null), bot("B", null)], "vc2"), "A");
});

test("다른 채널에서 쓰이고 있는 봇은 끌어오지 않는다", () => {
  assert.equal(chooseBot([bot("A", "vc1"), bot("B", "vc2")], "vc3"), "in-use");
  assert.equal(chooseBot([], "vc1"), "in-use");
});

test("쉬는 봇 중 권한이 있는 봇을 고르고, 없으면 cannot-join", () => {
  assert.equal(chooseBot([bot("A", null, false), bot("B", null)], "vc1"), "B");
  assert.equal(chooseBot([bot("A", null, false), bot("B", "vc2")], "vc1"), "cannot-join");
});

test("이미 채널에 있는 봇은 canJoin 과 상관없이 쓴다 (정원이 찬 채널)", () => {
  assert.equal(chooseBot([bot("A", "vc1", false)], "vc1"), "A");
});
