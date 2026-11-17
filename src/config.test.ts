import assert from "node:assert/strict";
import { test } from "node:test";
import { isGuildAllowed, loadConfig } from "./config.ts";

const base = { DISCORD_BOT_TOKENS: "a, b", TYPECAST_API_KEY: "key" };

test("기본값", () => {
  const config = loadConfig(base);
  assert.deepEqual(config.botTokens, ["a", "b"]);
  assert.equal(config.typecastModel, "auto");
  assert.equal(config.audioFormat, "mp3");
  assert.equal(config.maxChars, 200);
  assert.equal(config.databasePath, "data/ttsbot.db");
  assert.equal(config.typecastLanguage, undefined);
});

test("예전 DISCORD_BOT_TOKEN 하나만 있어도 된다", () => {
  assert.deepEqual(loadConfig({ DISCORD_BOT_TOKEN: "solo", TYPECAST_API_KEY: "key" }).botTokens, ["solo"]);
});

test("같은 토큰을 두 번 넣으면 한 번만 쓴다", () => {
  assert.deepEqual(loadConfig({ ...base, DISCORD_BOT_TOKENS: "a,a", DISCORD_BOT_TOKEN: "a" }).botTokens, ["a"]);
});

test("필수 값이 없거나 형식이 틀리면 어떤 변수인지 알려 준다", () => {
  assert.throws(() => loadConfig({ TYPECAST_API_KEY: "key" }), /DISCORD_BOT_TOKENS/);
  assert.throws(() => loadConfig({ DISCORD_BOT_TOKENS: "a" }), /TYPECAST_API_KEY/);
  assert.throws(() => loadConfig({ ...base, TYPECAST_MODEL: "v99" }), /TYPECAST_MODEL/);
  assert.throws(() => loadConfig({ ...base, TTS_MAX_CHARS: "0" }), /TTS_MAX_CHARS/);
  assert.throws(() => loadConfig({ ...base, TTS_MAX_CHARS: "abc" }), /TTS_MAX_CHARS/);
});

test("허용 서버 목록이 비어 있으면 모든 서버, 있으면 그 서버만", () => {
  assert.equal(isGuildAllowed(loadConfig(base), "1"), true);

  const limited = loadConfig({ ...base, ALLOWED_GUILD_IDS: "1, 2" });
  assert.equal(isGuildAllowed(limited, "2"), true);
  assert.equal(isGuildAllowed(limited, "3"), false);
});
