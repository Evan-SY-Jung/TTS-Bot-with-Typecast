/**
 * 디스코드 메시지를 Typecast에 넘기기 좋게 정리한다.
 * 멘션·커스텀 이모지·타임스탬프 같은 마크업을 걷어 내고 maxChars 까지만 남긴다.
 */
export function prepareText(raw: string, maxChars: number): string {
  const cleaned = raw
    .replace(/<@[!&]?\d+>/g, " ")
    .replace(/<#\d+>/g, " ")
    .replace(/<a?:\w+:\d+>/g, " ")
    .replace(/<t:\d+(?::[a-zA-Z])?>/g, " ")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  // 이모지 같은 서로게이트 쌍이 중간에서 잘리지 않게 코드 포인트 단위로 자른다.
  const chars = Array.from(cleaned);
  return chars.length > maxChars ? chars.slice(0, maxChars).join("").trim() : cleaned;
}

/**
 * Typecast는 문장부호·공백만 있는 텍스트를 전처리 단계에서 거부한다(TTS_PRE_PROCESS_ERROR).
 * 글자나 숫자가 하나라도 있을 때만 합성을 시도한다.
 */
export function hasSpeakableText(text: string): boolean {
  return /[\p{L}\p{N}]/u.test(text);
}
