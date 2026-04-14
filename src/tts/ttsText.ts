/** Typecast API 문서상 text 최대 길이 */
export const TYPECAST_TEXT_MAX_LENGTH = 5000;

/**
 * Discord 메시지를 Typecast에 넘기기 좋게 정리합니다.
 * 멘션/이모지/타임스탬프 등 잔여 마크업을 줄여 전처리 오류를 완화합니다.
 */
export function prepareDiscordTextForTts(raw: string): string {
  let s = raw.trim();
  s = s.replace(/<@!?\d+>/g, " ");
  s = s.replace(/<@&\d+>/g, " ");
  s = s.replace(/<#\d+>/g, " ");
  s = s.replace(/<a?:[^:]+:\d+>/g, " ");
  s = s.replace(/<t:\d+:[Rfdt]?>/g, " ");
  s = s.replace(/[\u200B-\u200D\uFEFF]/g, "");
  s = s.replace(/\s+/g, " ").trim();
  if (s.length > TYPECAST_TEXT_MAX_LENGTH) {
    s = s.slice(0, TYPECAST_TEXT_MAX_LENGTH);
  }
  return s;
}

/**
 * Typecast 쪽은 문장부호·공백만 있으면 전처리(TTS_PRE_PROCESS_ERROR)로 실패하는 경우가 많습니다.
 * 글자(한글 등)·숫자가 하나라도 있을 때만 합성을 시도합니다.
 */
export function hasSpeakableTextForTts(text: string): boolean {
  return /[\p{L}\p{N}]/u.test(text);
}
