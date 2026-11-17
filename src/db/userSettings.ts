import type { Database } from "./index.ts";

export interface UserSetting {
  /** 목소리 키. null 이면 서버 기본 목소리를 쓴다. */
  voice: string | null;
  /** TTS로 읽은 본인 메시지를 지울지 */
  deleteUserMessage: boolean;
}

export type UserSettings = ReturnType<typeof createUserSettings>;

/** 유저별 설정. 같은 유저라도 서버마다 따로 저장한다. */
export function createUserSettings(db: Database) {
  const select = db.prepare("SELECT voice, delete_user_message FROM user_settings WHERE guild_id = ? AND user_id = ?");
  const upsertVoice = db.prepare(`
    INSERT INTO user_settings (guild_id, user_id, voice) VALUES (?, ?, ?)
    ON CONFLICT (guild_id, user_id) DO UPDATE SET voice = excluded.voice
  `);
  const upsertDelete = db.prepare(`
    INSERT INTO user_settings (guild_id, user_id, delete_user_message) VALUES (?, ?, ?)
    ON CONFLICT (guild_id, user_id) DO UPDATE SET delete_user_message = excluded.delete_user_message
  `);
  const deleteByGuild = db.prepare("DELETE FROM user_settings WHERE guild_id = ?");

  return {
    get(guildId: string, userId: string): UserSetting {
      const row = select.get(guildId, userId);
      return {
        voice: typeof row?.voice === "string" ? row.voice : null,
        deleteUserMessage: row?.delete_user_message === 1,
      };
    },

    setVoice(guildId: string, userId: string, voiceKey: string): void {
      upsertVoice.run(guildId, userId, voiceKey);
    },

    setDeleteUserMessage(guildId: string, userId: string, enabled: boolean): void {
      upsertDelete.run(guildId, userId, enabled ? 1 : 0);
    },

    deleteGuild(guildId: string): void {
      deleteByGuild.run(guildId);
    },
  };
}
