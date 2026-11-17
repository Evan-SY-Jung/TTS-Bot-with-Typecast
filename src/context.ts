import type { Client } from "discord.js";
import type { AppConfig } from "./config.ts";
import type { GuildSettings } from "./db/guildSettings.ts";
import type { UserSettings } from "./db/userSettings.ts";
import type { Synthesize } from "./tts/typecast.ts";
import type { VoiceCatalog } from "./tts/voices.ts";

/** 커맨드와 이벤트 핸들러가 공유하는 것들. index.ts 에서 한 번 만든다. */
export interface AppContext {
  config: AppConfig;
  voices: VoiceCatalog;
  guildSettings: GuildSettings;
  userSettings: UserSettings;
  synthesize: Synthesize;
  /** 이 프로세스가 돌리는 봇 전부 (DISCORD_BOT_TOKENS 순서) */
  bots: Client[];
}
