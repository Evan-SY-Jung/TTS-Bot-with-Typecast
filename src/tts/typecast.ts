import { Readable } from "node:stream";
import { setTimeout as sleep } from "node:timers/promises";
import {
  type LanguageCode,
  type TTSModel,
  type TTSRequestStream,
  TypecastAPIError,
  TypecastClient,
} from "@neosapience/typecast-js";
import type { AppConfig, TypecastModelSetting } from "../config.ts";

/** 텍스트를 합성해 오디오 스트림(mp3/wav)으로 돌려준다. */
export type Synthesize = (text: string, voiceId: string) => Promise<Readable>;

type SynthConfig = Pick<AppConfig, "typecastApiKey" | "typecastModel" | "typecastLanguage" | "audioFormat">;
type StreamingClient = Pick<TypecastClient, "textToSpeechStream">;

const MAX_ATTEMPTS = 3;

/** 첫 모델이 이 목소리를 지원하지 않을 때 넘어갈 순서 */
export function modelOrder(setting: TypecastModelSetting): TTSModel[] {
  switch (setting) {
    case "ssfm-v21":
      return ["ssfm-v21", "ssfm-v30"];
    case "ssfm-v31":
      return ["ssfm-v31", "ssfm-v30"];
    default:
      return ["ssfm-v30", "ssfm-v21"];
  }
}

function isServerError(err: unknown): boolean {
  return err instanceof TypecastAPIError && err.statusCode >= 500;
}

/** 모델·목소리 조합 문제로 보이는 오류. 다른 모델로 다시 시도해 볼 만하다. */
function isModelMismatch(err: unknown): boolean {
  if (!(err instanceof TypecastAPIError)) return false;
  if ([400, 404, 422].includes(err.statusCode)) return true;
  return /model|voice/i.test(err.message);
}

export function createSynthesizer(
  config: SynthConfig,
  client: StreamingClient = new TypecastClient({ apiKey: config.typecastApiKey }),
  retryDelayMs = 1500,
): Synthesize {
  const models = modelOrder(config.typecastModel);

  /** 5xx 는 잠깐 기다렸다가 다시 시도한다. */
  async function requestWithRetry(request: TTSRequestStream) {
    for (let attempt = 1; ; attempt++) {
      try {
        return await client.textToSpeechStream(request);
      } catch (err) {
        if (!isServerError(err) || attempt >= MAX_ATTEMPTS) throw err;
        await sleep(retryDelayMs * attempt);
      }
    }
  }

  return async (text, voiceId) => {
    let lastError: unknown;

    for (const [index, model] of models.entries()) {
      try {
        // 스트리밍 응답이라 합성이 끝나기를 기다리지 않고 받는 대로 재생할 수 있다.
        const stream = await requestWithRetry({
          text,
          voice_id: voiceId,
          model,
          ...(config.typecastLanguage ? { language: config.typecastLanguage as LanguageCode } : {}),
          output: { audio_format: config.audioFormat },
        });
        if (index > 0) console.log(`[typecast] 보조 모델 ${model} 로 합성했습니다.`);
        return Readable.fromWeb(stream);
      } catch (err) {
        lastError = err;
        const next = models[index + 1];
        if (!next || !isModelMismatch(err)) throw err;
        console.warn(`[typecast] 모델 ${model} 실패 → ${next} 로 다시 시도:`, (err as Error).message);
      }
    }

    throw lastError;
  };
}
