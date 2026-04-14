"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupMessageCreateHandler = setupMessageCreateHandler;
const typecast_js_1 = require("@neosapience/typecast-js");
const config_1 = require("../../config");
const UserSetting_1 = require("../../db/models/UserSetting");
const play_1 = require("../../tts/play");
const ttsText_1 = require("../../tts/ttsText");
const speakingByGuild = new Map();
function isTriggerChannel(message) {
    const config = (0, config_1.getConfig)();
    return config.ttsTextChannelIds.includes(message.channelId);
}
/** TTS 트리거 메시지당 Mongo findOne 1회 */
async function fetchUserTtsSettings(guildId, userId) {
    const setting = (await UserSetting_1.UserSettingModel.findOne({ guildId, userId }).lean());
    const deleteUserMessage = setting?.deleteUserMessage ?? false;
    const v = setting?.voice;
    if (typeof v === "string" && (0, UserSetting_1.isTtsVoiceKey)(v)) {
        return { deleteUserMessage, voiceKey: v };
    }
    const g = setting?.gender;
    if (g === "female")
        return { deleteUserMessage, voiceKey: "sukhee" };
    if (g === "male")
        return { deleteUserMessage, voiceKey: "abong" };
    return { deleteUserMessage, voiceKey: (0, config_1.getConfig)().defaultTtsVoice };
}
async function safeDeleteMessage(message) {
    await message.delete().catch(() => { });
}
function formatTtsUserNotice(err) {
    if (err instanceof typecast_js_1.TypecastAPIError) {
        const code = err.response?.error_code;
        if (err.statusCode === 402) {
            return "Typecast 크레딧이 부족해요. 대시보드에서 충전·요금제를 확인해 주세요.";
        }
        if (err.statusCode === 429) {
            return "Typecast 요청 한도에 걸렸어요. 잠시 뒤 다시 시도해 주세요.";
        }
        if (err.statusCode === 401) {
            return "Typecast API 키가 잘못됐거나 만료됐어요. .env 의 TYPECAST_API_KEY 를 확인해 주세요.";
        }
        if (err.statusCode >= 500) {
            if (code === "TTS_PRE_PROCESS_ERROR") {
                return "음성 합성 전처리에 실패했어요. 특수문자·이모지를 줄이거나 문장을 짧게 나눠 보세요.";
            }
            return "Typecast 서버 오류가 났어요. 잠시 뒤 다시 시도해 주세요.";
        }
        return `음성 합성 오류 (${err.statusCode}). 잠시 뒤 다시 시도해 주세요.`;
    }
    if (err instanceof Error) {
        if (err.message === "TTS_TEXT_EMPTY" || err.message === "TTS_NO_SPEAKABLE_TEXT") {
            return "읽을 만한 글자가 없어요. 마침표·기호만 있으면 읽지 않아요.";
        }
        if (err.message.startsWith("TTS_TEXT_TOO_LONG")) {
            return "텍스트가 너무 길어요. 짧게 나눠서 보내 주세요.";
        }
        if (err.message === "TTS_VOICE_CONNECTION_LOST") {
            return "디스코드 음성 연결이 끊겼어요. 잠시 뒤 다시 시도해 주세요.";
        }
    }
    return "TTS 재생 중 오류가 났어요. 잠시 뒤 다시 시도해 주세요.";
}
async function safeSendEphemeralLikeReply(message, content, ttlMs) {
    const reply = await message
        .reply({ content, allowedMentions: { repliedUser: false } })
        .catch(() => null);
    if (!reply)
        return;
    setTimeout(() => {
        reply.delete().catch(() => { });
    }, ttlMs);
}
function setupMessageCreateHandler(client) {
    client.on("messageCreate", async (message) => {
        if (message.author.bot)
            return;
        if (!message.guild)
            return;
        if (!isTriggerChannel(message))
            return;
        const guildId = message.guildId;
        const channelId = message.channelId;
        if (!guildId || !channelId)
            return;
        const { deleteUserMessage, voiceKey } = await fetchUserTtsSettings(guildId, message.author.id);
        const currentlySpeaking = speakingByGuild.get(guildId) ?? false;
        if (currentlySpeaking) {
            if (deleteUserMessage) {
                await safeDeleteMessage(message);
                await safeSendEphemeralLikeReply(message, "현재 TTS를 재생 중이라 이 메시지는 읽지 못했어요.", (0, config_1.getConfig)().ignoredMessageNoticeTtlMs);
            }
            return;
        }
        speakingByGuild.set(guildId, true);
        try {
            if (deleteUserMessage) {
                await safeDeleteMessage(message);
            }
            const member = message.member ?? (await message.guild.members.fetch(message.author.id).catch(() => null));
            const voiceChannel = member?.voice.channel;
            if (!voiceChannel) {
                await safeSendEphemeralLikeReply(message, "음성 채널에 먼저 접속한 뒤 다시 메시지를 보내주세요.", (0, config_1.getConfig)().ignoredMessageNoticeTtlMs);
                return;
            }
            const base = (message.cleanContent ?? message.content ?? "").trim();
            const text = (0, ttsText_1.prepareDiscordTextForTts)(base);
            if (!text || !(0, ttsText_1.hasSpeakableTextForTts)(text)) {
                await safeSendEphemeralLikeReply(message, "글자나 숫자가 들어간 말만 읽을 수 있어요. 마침표·기호·공백만 있으면 Typecast에서 처리하지 못해요.", (0, config_1.getConfig)().ignoredMessageNoticeTtlMs);
                return;
            }
            try {
                await (0, play_1.playTtsToVoiceChannel)({
                    voiceChannel,
                    text,
                    voiceKey,
                });
            }
            catch (err) {
                console.error("TTS/play error:", err);
                const notice = formatTtsUserNotice(err);
                await safeSendEphemeralLikeReply(message, notice, (0, config_1.getConfig)().ignoredMessageNoticeTtlMs).catch(async () => {
                    await message.channel
                        .send({
                        content: `<@${message.author.id}> ${notice}`,
                        allowedMentions: { users: [message.author.id] },
                    })
                        .catch(() => { });
                });
            }
        }
        finally {
            speakingByGuild.set(guildId, false);
        }
    });
}
