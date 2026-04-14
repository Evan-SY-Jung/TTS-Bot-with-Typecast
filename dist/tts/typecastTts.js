"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.synthesizeTypecastForPlayback = synthesizeTypecastForPlayback;
const voice_1 = require("@discordjs/voice");
const typecast_js_1 = require("@neosapience/typecast-js");
const config_1 = require("../config");
const ttsText_1 = require("./ttsText");
let typecastClient = null;
function getTypecastClient() {
    if (!typecastClient) {
        typecastClient = new typecast_js_1.TypecastClient({ apiKey: (0, config_1.getConfig)().typecastApiKey });
    }
    return typecastClient;
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
async function textToSpeechWithRetry(client, request) {
    const maxAttempts = 3;
    let lastErr;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await client.textToSpeech(request);
        }
        catch (e) {
            lastErr = e;
            const retryable = e instanceof typecast_js_1.TypecastAPIError && e.statusCode >= 500 && e.statusCode < 600;
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
function concreteModelOrder(primary) {
    if (primary === "auto")
        return ["ssfm-v30", "ssfm-v21"];
    if (primary === "ssfm-v30")
        return ["ssfm-v30", "ssfm-v21"];
    return ["ssfm-v21", "ssfm-v30"];
}
function shouldTryAlternateModel(err) {
    if (!(err instanceof typecast_js_1.TypecastAPIError))
        return false;
    if (err.statusCode === 422 || err.statusCode === 400)
        return true;
    if (err.statusCode === 404)
        return true;
    const msg = err.message.toLowerCase();
    return msg.includes("model") || msg.includes("voice");
}
/**
 * Typecast TTS → Buffer.
 * MP3/WAV는 Opus가 아니므로 Discord 재생 시 `StreamType.Arbitrary`와 FFmpeg가 필요합니다(또는 ffmpeg-static).
 */
async function synthesizeTypecastForPlayback(text, voiceKey) {
    const trimmed = text.trim();
    if (trimmed.length === 0) {
        throw new Error("TTS_TEXT_EMPTY");
    }
    if (trimmed.length > ttsText_1.TYPECAST_TEXT_MAX_LENGTH) {
        throw new Error(`TTS_TEXT_TOO_LONG(max ${ttsText_1.TYPECAST_TEXT_MAX_LENGTH})`);
    }
    if (!(0, ttsText_1.hasSpeakableTextForTts)(trimmed)) {
        throw new Error("TTS_NO_SPEAKABLE_TEXT");
    }
    const config = (0, config_1.getConfig)();
    const voiceId = config.typecastVoices[voiceKey];
    const client = getTypecastClient();
    const baseRequest = {
        text: trimmed,
        voice_id: voiceId,
        ...(config.typecastLanguage
            ? { language: config.typecastLanguage }
            : {}),
        output: {
            audio_format: config.typecastAudioFormat,
        },
    };
    const models = concreteModelOrder(config.typecastModel);
    let lastErr;
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
                streamType: voice_1.StreamType.Arbitrary,
            };
        }
        catch (e) {
            lastErr = e;
            const hasNext = i < models.length - 1;
            if (hasNext && shouldTryAlternateModel(e)) {
                console.warn(`Typecast TTS 모델 ${model} 실패 → ${models[i + 1]} 재시도:`, e instanceof Error ? e.message : e);
                continue;
            }
            throw e;
        }
    }
    throw lastErr;
}
