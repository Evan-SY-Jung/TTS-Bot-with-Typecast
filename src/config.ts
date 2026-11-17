import type { TTSModel } from "@neosapience/typecast-js";

/** auto: ssfm-v30 → 실패하면 ssfm-v21 순서로 시도 */
export type TypecastModelSetting = TTSModel | "auto";
export type AudioFormat = "mp3" | "wav";

export interface AppConfig {
  /** 봇 토큰 목록. 한 서버에서 음성 채널 여러 곳을 동시에 쓰려면 봇을 여러 개 넣는다. */
  botTokens: string[];
  typecastApiKey: string;
  typecastModel: TypecastModelSetting;
  /** ISO 639-3 (예: kor). 비우면 Typecast가 자동 감지한다. */
  typecastLanguage: string | undefined;
  audioFormat: AudioFormat;
  /** 기본 목소리 키. 비우면 voices.json의 첫 번째 목소리. */
  defaultVoice: string | undefined;
  /** 메시지 하나에서 읽는 최대 글자 수. 넘는 부분은 잘라낸다. */
  maxChars: number;
  /** 비어 있으면 모든 서버에서 동작한다. */
  allowedGuildIds: ReadonlySet<string>;
  databasePath: string;
  voicesPath: string;
  /** 안내 메시지를 지우기까지의 시간 */
  noticeTtlMs: number;
}

type Env = Record<string, string | undefined>;

const TYPECAST_MODELS = ["auto", "ssfm-v21", "ssfm-v30", "ssfm-v31"] as const;
const AUDIO_FORMATS = ["mp3", "wav"] as const;
/** Typecast API가 받는 text 최대 길이 */
const TYPECAST_TEXT_LIMIT = 5000;

function optional(env: Env, key: string): string | undefined {
  const value = env[key]?.trim();
  return value ? value : undefined;
}

function required(env: Env, key: string): string {
  const value = optional(env, key);
  if (!value) throw new Error(`환경변수 ${key} 가 비어 있습니다.`);
  return value;
}

function list(env: Env, key: string): string[] {
  return (optional(env, key) ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function oneOf<const T extends readonly string[]>(env: Env, key: string, allowed: T, fallback: T[number]): T[number] {
  const value = optional(env, key);
  if (value === undefined) return fallback;
  if (!allowed.includes(value)) {
    throw new Error(`${key} 는 ${allowed.join(", ")} 중 하나여야 합니다. (받은 값: ${value})`);
  }
  return value;
}

function integer(env: Env, key: string, fallback: number, min: number, max: number): number {
  const raw = optional(env, key);
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${key} 는 ${min}~${max} 사이의 정수여야 합니다. (받은 값: ${raw})`);
  }
  return value;
}

export function loadConfig(env: Env = process.env): AppConfig {
  // DISCORD_BOT_TOKEN 하나만 있는 예전 .env 도 그대로 동작한다.
  const botTokens = [...new Set([...list(env, "DISCORD_BOT_TOKENS"), ...list(env, "DISCORD_BOT_TOKEN")])];
  if (botTokens.length === 0) {
    throw new Error("환경변수 DISCORD_BOT_TOKENS 에 봇 토큰을 하나 이상 넣어 주세요.");
  }

  return {
    botTokens,
    typecastApiKey: required(env, "TYPECAST_API_KEY"),
    typecastModel: oneOf(env, "TYPECAST_MODEL", TYPECAST_MODELS, "auto"),
    typecastLanguage: optional(env, "TYPECAST_LANGUAGE"),
    audioFormat: oneOf(env, "TYPECAST_AUDIO_FORMAT", AUDIO_FORMATS, "mp3"),
    defaultVoice: optional(env, "DEFAULT_TTS_VOICE"),
    maxChars: integer(env, "TTS_MAX_CHARS", 200, 1, TYPECAST_TEXT_LIMIT),
    allowedGuildIds: new Set(list(env, "ALLOWED_GUILD_IDS")),
    databasePath: optional(env, "DATABASE_PATH") ?? "data/ttsbot.db",
    voicesPath: optional(env, "VOICES_PATH") ?? "config/voices.json",
    noticeTtlMs: 5000,
  };
}

export function isGuildAllowed(config: AppConfig, guildId: string): boolean {
  return config.allowedGuildIds.size === 0 || config.allowedGuildIds.has(guildId);
}
