import { TypecastAPIError } from "@neosapience/typecast-js";

export type TtsErrorCode = "BUSY" | "VOICE_CONNECTION_FAILED";

export class TtsError extends Error {
  readonly code: TtsErrorCode;

  constructor(code: TtsErrorCode, options?: ErrorOptions) {
    super(code, options);
    this.name = "TtsError";
    this.code = code;
  }
}

/** 오류를 채널에 띄울 안내 문구로 바꾼다. */
export function describeTtsError(err: unknown): string {
  if (err instanceof TtsError) {
    switch (err.code) {
      case "BUSY":
        return "현재 TTS를 재생 중이라 이 메시지는 읽지 못했어요.";
      case "VOICE_CONNECTION_FAILED":
        return "디스코드 음성 연결에 실패했어요. 잠시 뒤 다시 시도해 주세요.";
    }
  }

  if (err instanceof TypecastAPIError) {
    const { statusCode } = err;
    if (statusCode === 401) return "Typecast API 키가 잘못됐거나 만료됐어요. 봇 관리자에게 알려 주세요.";
    if (statusCode === 402) return "Typecast 크레딧이 부족해요. 봇 관리자에게 알려 주세요.";
    if (statusCode === 429) return "Typecast 요청 한도에 걸렸어요. 잠시 뒤 다시 시도해 주세요.";
    if (statusCode >= 500) {
      return err.response?.error_code === "TTS_PRE_PROCESS_ERROR"
        ? "음성 합성 전처리에 실패했어요. 특수문자·이모지를 줄이거나 문장을 짧게 나눠 보세요."
        : "Typecast 서버 오류가 났어요. 잠시 뒤 다시 시도해 주세요.";
    }
    return `음성 합성 오류 (${statusCode}). 잠시 뒤 다시 시도해 주세요.`;
  }

  return "TTS 재생 중 오류가 났어요. 잠시 뒤 다시 시도해 주세요.";
}
