import assert from "node:assert/strict";
import { test } from "node:test";
import { createVoiceCatalog, loadVoiceCatalog, voiceEnvKey } from "./voices.ts";

const entries = [
  { key: "abong", label: "아봉", voiceId: "tc_a" },
  { key: "dukchan", label: "덕찬" },
];
const env = { TYPECAST_VOICE_DUKCHAN: "tc_d" };

test("voiceId 가 없으면 환경변수에서 가져온다", () => {
  const catalog = createVoiceCatalog(entries, env);
  assert.equal(catalog.get("abong")?.voiceId, "tc_a");
  assert.equal(catalog.get("dukchan")?.voiceId, "tc_d");
  assert.equal(voiceEnvKey("my-voice"), "TYPECAST_VOICE_MY_VOICE");
});

test("voice_id 를 어디서도 못 찾으면 어떤 환경변수가 필요한지 알려 준다", () => {
  assert.throws(() => createVoiceCatalog(entries, {}), /TYPECAST_VOICE_DUKCHAN/);
});

test("기본 목소리는 지정한 키, 없으면 첫 번째", () => {
  assert.equal(createVoiceCatalog(entries, env).fallback.key, "abong");
  assert.equal(createVoiceCatalog(entries, env, "dukchan").fallback.key, "dukchan");
  assert.throws(() => createVoiceCatalog(entries, env, "nope"), /DEFAULT_TTS_VOICE/);
});

test("resolve 는 유저 → 서버 → 기본 순서로 고르고, 목록에서 빠진 키는 건너뛴다", () => {
  const catalog = createVoiceCatalog(entries, env);
  assert.equal(catalog.resolve("dukchan", "abong").key, "dukchan");
  assert.equal(catalog.resolve(null, "dukchan").key, "dukchan");
  assert.equal(catalog.resolve("removed", null).key, "abong");
});

test("키나 이름으로 찾고 검색한다", () => {
  const catalog = createVoiceCatalog(entries, env);
  assert.equal(catalog.find("덕찬")?.key, "dukchan");
  assert.equal(catalog.find("ABONG")?.key, "abong");
  assert.equal(catalog.find("없음"), undefined);
  assert.deepEqual(
    catalog.search("덕").map((v) => v.key),
    ["dukchan"],
  );
  assert.equal(catalog.search("").length, 2);
});

test("잘못된 목록은 거부한다", () => {
  assert.throws(() => createVoiceCatalog([], env), /비어/);
  assert.throws(() => createVoiceCatalog([{ key: "Bad Key", voiceId: "x" }], env), /key/);
  assert.throws(() => createVoiceCatalog([entries[0], entries[0]], env), /겹칩니다/);
});

test("레포의 config/voices.json 은 예전 .env 의 TYPECAST_VOICE_* 로 그대로 읽힌다", () => {
  const legacyEnv = Object.fromEntries(
    ["ABONG", "ASMR", "DUKCHAN", "CHANGU", "CHANGSU", "LETTER", "KIRI", "SUKHEE"].map((name) => [
      `TYPECAST_VOICE_${name}`,
      `tc_${name.toLowerCase()}`,
    ]),
  );
  const catalog = loadVoiceCatalog("config/voices.json", legacyEnv);
  assert.equal(catalog.all.length, 8);
  assert.equal(catalog.fallback.key, "abong");
});
