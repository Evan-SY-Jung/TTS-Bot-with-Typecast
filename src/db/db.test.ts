import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createGuildSettings } from "./guildSettings.ts";
import { openDatabase } from "./index.ts";
import { createUserSettings } from "./userSettings.ts";

test("TTS 채널 등록·해제·목록", () => {
  const guilds = createGuildSettings(openDatabase(":memory:"));

  assert.equal(guilds.addChannel("g1", "c1"), true);
  assert.equal(guilds.addChannel("g1", "c1"), false);
  assert.equal(guilds.addChannel("g1", "c2"), true);
  assert.equal(guilds.addChannel("g2", "c3"), true);

  assert.equal(guilds.isTtsChannel("c1"), true);
  assert.equal(guilds.isTtsChannel("nope"), false);
  assert.deepEqual(guilds.listChannels("g1"), ["c1", "c2"]);

  assert.equal(guilds.removeChannel("c1"), true);
  assert.equal(guilds.removeChannel("c1"), false);
  assert.deepEqual(guilds.listChannels("g1"), ["c2"]);
});

test("서버 기본 목소리", () => {
  const guilds = createGuildSettings(openDatabase(":memory:"));
  assert.equal(guilds.getDefaultVoice("g1"), null);
  guilds.setDefaultVoice("g1", "abong");
  guilds.setDefaultVoice("g1", "dukchan");
  assert.equal(guilds.getDefaultVoice("g1"), "dukchan");
});

test("유저 설정은 서버마다 따로이고, 한 항목을 바꿔도 다른 항목은 유지된다", () => {
  const users = createUserSettings(openDatabase(":memory:"));
  assert.deepEqual(users.get("g1", "u1"), { voice: null, deleteUserMessage: false });

  users.setVoice("g1", "u1", "dukchan");
  users.setDeleteUserMessage("g1", "u1", true);
  users.setVoice("g1", "u1", "kiri");
  assert.deepEqual(users.get("g1", "u1"), { voice: "kiri", deleteUserMessage: true });

  users.setDeleteUserMessage("g1", "u1", false);
  assert.deepEqual(users.get("g1", "u1"), { voice: "kiri", deleteUserMessage: false });
  assert.deepEqual(users.get("g2", "u1"), { voice: null, deleteUserMessage: false });
});

test("서버 설정 삭제는 그 서버 것만 지운다", () => {
  const db = openDatabase(":memory:");
  const guilds = createGuildSettings(db);
  const users = createUserSettings(db);
  guilds.addChannel("g1", "c1");
  guilds.addChannel("g2", "c2");
  guilds.setDefaultVoice("g1", "abong");
  users.setVoice("g1", "u1", "abong");
  users.setVoice("g2", "u1", "kiri");

  guilds.deleteGuild("g1");
  users.deleteGuild("g1");

  assert.equal(guilds.isTtsChannel("c1"), false);
  assert.equal(guilds.isTtsChannel("c2"), true);
  assert.equal(guilds.getDefaultVoice("g1"), null);
  assert.equal(users.get("g1", "u1").voice, null);
  assert.equal(users.get("g2", "u1").voice, "kiri");
});

test("파일 DB는 다시 열어도 설정이 남아 있고 마이그레이션은 한 번만 적용된다", () => {
  const dir = mkdtempSync(join(tmpdir(), "ttsbot-"));
  const path = join(dir, "nested", "ttsbot.db");
  try {
    const first = openDatabase(path);
    createGuildSettings(first).addChannel("g1", "c1");
    createUserSettings(first).setVoice("g1", "u1", "dukchan");
    first.close();

    const second = openDatabase(path);
    assert.equal(createGuildSettings(second).isTtsChannel("c1"), true);
    assert.equal(createUserSettings(second).get("g1", "u1").voice, "dukchan");
    assert.equal(second.prepare("SELECT COUNT(*) AS n FROM schema_migrations").get()?.n, 1);
    second.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
