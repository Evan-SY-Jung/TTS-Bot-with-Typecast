export interface Migration {
  id: string;
  sql: string;
}

/** 한번 배포한 항목은 고치지 않는다. 스키마를 바꿀 때는 맨 아래에 새 항목을 추가한다. */
export const migrations: readonly Migration[] = [
  {
    id: "001_init",
    sql: `
      CREATE TABLE guild_settings (
        guild_id      TEXT PRIMARY KEY,
        default_voice TEXT
      ) STRICT;

      CREATE TABLE tts_channels (
        channel_id TEXT PRIMARY KEY,
        guild_id   TEXT NOT NULL
      ) STRICT;
      CREATE INDEX tts_channels_guild ON tts_channels (guild_id);

      CREATE TABLE user_settings (
        guild_id            TEXT NOT NULL,
        user_id             TEXT NOT NULL,
        voice               TEXT,
        delete_user_message INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (guild_id, user_id)
      ) STRICT;
    `,
  },
];
