import { type Database, transaction } from "./index.ts";

export type GuildSettings = ReturnType<typeof createGuildSettings>;

/**
 * 서버별 설정: TTS 채널 목록과 서버 기본 목소리.
 * TTS 채널 여부는 모든 메시지마다 확인하므로 메모리에 올려 둔다.
 */
export function createGuildSettings(db: Database) {
  const channels = new Map<string, string>();
  for (const row of db.prepare("SELECT channel_id, guild_id FROM tts_channels").all()) {
    channels.set(String(row.channel_id), String(row.guild_id));
  }

  const insertChannel = db.prepare("INSERT OR IGNORE INTO tts_channels (channel_id, guild_id) VALUES (?, ?)");
  const deleteChannel = db.prepare("DELETE FROM tts_channels WHERE channel_id = ?");
  const selectDefaultVoice = db.prepare("SELECT default_voice FROM guild_settings WHERE guild_id = ?");
  const upsertDefaultVoice = db.prepare(`
    INSERT INTO guild_settings (guild_id, default_voice) VALUES (?, ?)
    ON CONFLICT (guild_id) DO UPDATE SET default_voice = excluded.default_voice
  `);
  const deleteGuildChannels = db.prepare("DELETE FROM tts_channels WHERE guild_id = ?");
  const deleteGuildSettings = db.prepare("DELETE FROM guild_settings WHERE guild_id = ?");

  return {
    isTtsChannel(channelId: string): boolean {
      return channels.has(channelId);
    },

    listChannels(guildId: string): string[] {
      return [...channels].filter(([, guild]) => guild === guildId).map(([channelId]) => channelId);
    },

    /** 이미 등록된 채널이면 false */
    addChannel(guildId: string, channelId: string): boolean {
      if (channels.has(channelId)) return false;
      insertChannel.run(channelId, guildId);
      channels.set(channelId, guildId);
      return true;
    },

    /** 등록되지 않은 채널이면 false */
    removeChannel(channelId: string): boolean {
      deleteChannel.run(channelId);
      return channels.delete(channelId);
    },

    getDefaultVoice(guildId: string): string | null {
      const value = selectDefaultVoice.get(guildId)?.default_voice;
      return typeof value === "string" ? value : null;
    },

    setDefaultVoice(guildId: string, voiceKey: string): void {
      upsertDefaultVoice.run(guildId, voiceKey);
    },

    deleteGuild(guildId: string): void {
      transaction(db, () => {
        deleteGuildChannels.run(guildId);
        deleteGuildSettings.run(guildId);
      });
      for (const [channelId, guild] of channels) {
        if (guild === guildId) channels.delete(channelId);
      }
    },
  };
}
