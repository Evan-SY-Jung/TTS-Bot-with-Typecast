import { StreamType } from "@discordjs/voice";
import {
  TypecastAPIError,
  TypecastClient,
  type LanguageCode,
  type TTSRequest,
  type TTSModel,
} from "@neosapience/typecast-js";
import { getConfig, type TypecastModel } from "../config";
import type { TtsVoiceKey } from "../db/models/UserSetting";
import { TYPECAST_TEXT_MAX_LENGTH, hasSpeakableTextForTts } from "./ttsText";

export type TypecastPlaybackAudio = {
  buffer: Buffer;
  streamType: StreamType;
};

let typecastClient: TypecastClient | null = null;

function getTypecastClient(): TypecastClient {
  if (!typecastClient) {
    typecastClient = new TypecastClient({ apiKey: getConfig().typecastApiKey });
  }
  return typecastClient;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function textToSpeechWithRetry(
  client: TypecastClient,
  request: TTSRequest
): Promise<Awaited<ReturnType<TypecastClient["textToSpeech"]>>> {
  const maxAttempts = 3;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await client.textToSpeech(request);
    } catch (e) {
      lastErr = e;
      const retryable =
        e instanceof TypecastAPIError && e.statusCode >= 500 && e.statusCode < 600;
      if (retryable && attempt < maxAttempts) {
        await sleep(1500 * attempt);
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}

/** env 기준으로 v30 / v21 시도 순서 (둘 다 쓸 수 있게 폴백) */
function concreteModelOrder(primary: TypecastModel): TTSModel[] {
  if (primary === "auto") return ["ssfm-v30", "ssfm-v21"];
  if (primary === "ssfm-v30") return ["ssfm-v30", "ssfm-v21"];
  return ["ssfm-v21", "ssfm-v30"];
}

function shouldTryAlternateModel(err: unknown): boolean {
  if (!(err instanceof TypecastAPIError)) return false;
  if (err.statusCode === 422 || err.statusCode === 400) return true;
  if (err.statusCode === 404) return true;
  const msg = err.message.toLowerCase();
  return msg.includes("model") || msg.includes("voice");
}

/**
 * Typecast TTS → Buffer.
 * MP3/WAV는 Opus가 아니므로 Discord 재생 시 `StreamType.Arbitrary`와 FFmpeg가 필요합니다(또는 ffmpeg-static).
 */
export async function synthesizeTypecastForPlayback(
  text: string,
  voiceKey: TtsVoiceKey
): Promise<TypecastPlaybackAudio> {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    throw new Error("TTS_TEXT_EMPTY");
  }
  if (trimmed.length > TYPECAST_TEXT_MAX_LENGTH) {
    throw new Error(`TTS_TEXT_TOO_LONG(max ${TYPECAST_TEXT_MAX_LENGTH})`);
  }
  if (!hasSpeakableTextForTts(trimmed)) {
    throw new Error("TTS_NO_SPEAKABLE_TEXT");
  }

  const config = getConfig();
  const voiceId = config.typecastVoices[voiceKey];
  const client = getTypecastClient();

  const baseRequest: Omit<TTSRequest, "model"> = {
    text: trimmed,
    voice_id: voiceId,
    ...(config.typecastLanguage
      ? { language: config.typecastLanguage as LanguageCode }
      : {}),
    output: {
      audio_format: config.typecastAudioFormat,
    },
  };

  const models = concreteModelOrder(config.typecastModel);
  let lastErr: unknown;

  for (let i = 0; i < models.length; i++) {
    const model = models[i];
    try {
      const response = await textToSpeechWithRetry(client, { ...baseRequest, model });
      const buffer = Buffer.from(response.audioData);
      if (buffer.length === 0) {
        throw new Error("Typecast TTS returned empty audio.");
      }
      if (i > 0) {
        console.log(`Typecast TTS: 보조 모델 ${model} 로 합성 성공`);
      }
      return {
        buffer,
        streamType: StreamType.Arbitrary,
      };
    } catch (e) {
      lastErr = e;
      const hasNext = i < models.length - 1;
      if (hasNext && shouldTryAlternateModel(e)) {
        console.warn(
          `Typecast TTS 모델 ${model} 실패 → ${models[i + 1]} 재시도:`,
          e instanceof Error ? e.message : e
        );
        continue;
      }
      throw e;
    }
  }

  throw lastErr;
}
