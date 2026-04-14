import dotenv from "dotenv";
import type { TtsVoiceKey } from "./db/models/UserSetting";
import { TTS_VOICE_KEYS, isTtsVoiceKey } from "./db/models/UserSetting";

dotenv.config();

/** auto: v30 → 실패 시 v21 순으로 시도 */
export type TypecastModel = "ssfm-v21" | "ssfm-v30" | "auto";
export type TypecastAudioFormat = "mp3" | "wav";

export type AppConfig = {
  discordBotToken: string;
  discordClientId?: string;
  discordGuildId?: string;

  mongoUri: string;

  /** Typecast API — https://typecast.ai/developers */
  typecastApiKey: string;
  typecastModel: TypecastModel;
  /** 슬래시 /voice 목소리별 Typecast voice_id */
  typecastVoices: Record<TtsVoiceKey, string>;
  /** ISO 639-3 (예: kor). 비우면 Typecast 자동 감지 */
  typecastLanguage?: string;
  typecastAudioFormat: TypecastAudioFormat;

  ttsTextChannelIds: string[];

  /** 신규 유저 기본 목소리 키 */
  defaultTtsVoice: TtsVoiceKey;

  ignoredMessageNoticeTtlMs: number;
};

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value || value.trim().length === 0) {
    throw new Error(`${key} is required but empty.`);
  }
  return value.trim();
}

function optionalEnv(key: string): string | undefined {
  const value = process.env[key];
  if (!value || value.trim().length === 0) return undefined;
  return value.trim();
}

function parseTypecastModel(raw: string): TypecastModel {
  if (raw === "ssfm-v21" || raw === "ssfm-v30" || raw === "auto") return raw;
  throw new Error(`TYPECAST_MODEL must be ssfm-v21, ssfm-v30, or auto, got: ${raw}`);
}

function parseTypecastAudioFormat(raw: string): TypecastAudioFormat {
  if (raw === "mp3" || raw === "wav") return raw;
  throw new Error(`TYPECAST_AUDIO_FORMAT must be mp3 or wav, got: ${raw}`);
}

function parseDefaultTtsVoice(raw: string | undefined): TtsVoiceKey {
  if (!raw) return "abong";
  const t = raw.trim();
  if (!isTtsVoiceKey(t)) {
    throw new Error(
      `DEFAULT_TTS_VOICE must be one of: ${TTS_VOICE_KEYS.join(", ")}, got: ${raw}`
    );
  }
  return t;
}

const VOICE_ENV_KEYS: Record<TtsVoiceKey, string> = {
  abong: "TYPECAST_VOICE_ABONG",
  asmr: "TYPECAST_VOICE_ASMR",
  dukchan: "TYPECAST_VOICE_DUKCHAN",
  changu: "TYPECAST_VOICE_CHANGU",
  changsu: "TYPECAST_VOICE_CHANGSU",
  letter: "TYPECAST_VOICE_LETTER",
  kiri: "TYPECAST_VOICE_KIRI",
  sukhee: "TYPECAST_VOICE_SUKHEE",
};

function loadTypecastVoices(): Record<TtsVoiceKey, string> {
  const out = {} as Record<TtsVoiceKey, string>;
  for (const key of TTS_VOICE_KEYS) {
    out[key] = requireEnv(VOICE_ENV_KEYS[key]);
  }
  return out;
}

export function getConfig(): AppConfig {
  const discordBotToken = requireEnv("DISCORD_BOT_TOKEN");
  const discordClientId = optionalEnv("DISCORD_CLIENT_ID");
  const discordGuildId = optionalEnv("DISCORD_GUILD_ID");

  const mongoUri = requireEnv("MONGODB_URI");

  const typecastApiKey = requireEnv("TYPECAST_API_KEY");
  const typecastModelRaw = optionalEnv("TYPECAST_MODEL");
  const typecastModel = typecastModelRaw ? parseTypecastModel(typecastModelRaw) : "auto";
  const typecastVoices = loadTypecastVoices();
  const typecastLanguage = optionalEnv("TYPECAST_LANGUAGE");
  const typecastAudioFormat = parseTypecastAudioFormat(
    optionalEnv("TYPECAST_AUDIO_FORMAT") ?? "mp3"
  );

  const ttsTextChannelIdsRaw = requireEnv("TTS_TEXT_CHANNEL_IDS");
  const ttsTextChannelIds = ttsTextChannelIdsRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (ttsTextChannelIds.length === 0) {
    throw new Error("TTS_TEXT_CHANNEL_IDS must contain at least one channel id.");
  }

  const defaultTtsVoice = parseDefaultTtsVoice(optionalEnv("DEFAULT_TTS_VOICE"));

  return {
    discordBotToken,
    discordClientId,
    discordGuildId,
    mongoUri,
    typecastApiKey,
    typecastModel,
    typecastVoices,
    typecastLanguage,
    typecastAudioFormat,
    ttsTextChannelIds,
    defaultTtsVoice,
    ignoredMessageNoticeTtlMs: 5000,
  };
}
