"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserSettingModel = exports.TTS_VOICE_LABEL = exports.TTS_VOICE_KEYS = void 0;
exports.isTtsVoiceKey = isTtsVoiceKey;
const mongoose_1 = require("mongoose");
/** 슬래시 /voice 및 env TYPECAST_VOICE_* 와 대응 (순서는 슬래시 선택지 표시 순) */
exports.TTS_VOICE_KEYS = [
    "abong",
    "asmr",
    "dukchan",
    "changu",
    "changsu",
    "letter",
    "kiri",
    "sukhee",
];
exports.TTS_VOICE_LABEL = {
    abong: "아봉",
    asmr: "ASMR",
    dukchan: "덕찬",
    changu: "찬구",
    changsu: "창수",
    letter: "래터",
    kiri: "키리",
    sukhee: "숙희",
};
function isTtsVoiceKey(s) {
    return exports.TTS_VOICE_KEYS.includes(s);
}
const userSettingSchema = new mongoose_1.Schema({
    guildId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    voice: {
        type: String,
        required: true,
        enum: [...exports.TTS_VOICE_KEYS],
        default: "abong",
    },
    deleteUserMessage: { type: Boolean, required: true, default: false },
}, { timestamps: true });
userSettingSchema.index({ guildId: 1, userId: 1 }, { unique: true });
exports.UserSettingModel = (0, mongoose_1.model)("UserSetting", userSettingSchema);
