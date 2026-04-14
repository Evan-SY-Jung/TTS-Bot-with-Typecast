"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getConfig = getConfig;
const dotenv_1 = __importDefault(require("dotenv"));
const UserSetting_1 = require("./db/models/UserSetting");
dotenv_1.default.config();
function requireEnv(key) {
    const value = process.env[key];
    if (!value || value.trim().length === 0) {
        throw new Error(`${key} is required but empty.`);
    }
    return value.trim();
}
function optionalEnv(key) {
    const value = process.env[key];
    if (!value || value.trim().length === 0)
        return undefined;
    return value.trim();
}
function parseTypecastModel(raw) {
    if (raw === "ssfm-v21" || raw === "ssfm-v30" || raw === "auto")
        return raw;
    throw new Error(`TYPECAST_MODEL must be ssfm-v21, ssfm-v30, or auto, got: ${raw}`);
}
function parseTypecastAudioFormat(raw) {
    if (raw === "mp3" || raw === "wav")
        return raw;
    throw new Error(`TYPECAST_AUDIO_FORMAT must be mp3 or wav, got: ${raw}`);
}
function parseDefaultTtsVoice(raw) {
    if (!raw)
        return "abong";
    const t = raw.trim();
    if (!(0, UserSetting_1.isTtsVoiceKey)(t)) {
        throw new Error(`DEFAULT_TTS_VOICE must be one of: ${UserSetting_1.TTS_VOICE_KEYS.join(", ")}, got: ${raw}`);
    }
    return t;
}
const VOICE_ENV_KEYS = {
    abong: "TYPECAST_VOICE_ABONG",
    asmr: "TYPECAST_VOICE_ASMR",
    dukchan: "TYPECAST_VOICE_DUKCHAN",
    changu: "TYPECAST_VOICE_CHANGU",
    changsu: "TYPECAST_VOICE_CHANGSU",
    letter: "TYPECAST_VOICE_LETTER",
    kiri: "TYPECAST_VOICE_KIRI",
    sukhee: "TYPECAST_VOICE_SUKHEE",
};
function loadTypecastVoices() {
    const out = {};
    for (const key of UserSetting_1.TTS_VOICE_KEYS) {
        out[key] = requireEnv(VOICE_ENV_KEYS[key]);
    }
    return out;
}
function getConfig() {
    const discordBotToken = requireEnv("DISCORD_BOT_TOKEN");
    const discordClientId = optionalEnv("DISCORD_CLIENT_ID");
    const discordGuildId = optionalEnv("DISCORD_GUILD_ID");
    const mongoUri = requireEnv("MONGODB_URI");
    const typecastApiKey = requireEnv("TYPECAST_API_KEY");
    const typecastModelRaw = optionalEnv("TYPECAST_MODEL");
    const typecastModel = typecastModelRaw ? parseTypecastModel(typecastModelRaw) : "auto";
    const typecastVoices = loadTypecastVoices();
    const typecastLanguage = optionalEnv("TYPECAST_LANGUAGE");
    const typecastAudioFormat = parseTypecastAudioFormat(optionalEnv("TYPECAST_AUDIO_FORMAT") ?? "mp3");
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
