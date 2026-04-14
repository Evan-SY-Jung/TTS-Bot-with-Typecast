import { Document, Schema, model } from "mongoose";

/** 슬래시 /voice 및 env TYPECAST_VOICE_* 와 대응 (순서는 슬래시 선택지 표시 순) */
export const TTS_VOICE_KEYS = [
  "abong",
  "asmr",
  "dukchan",
  "changu",
  "changsu",
  "letter",
  "kiri",
  "sukhee",
] as const;

export type TtsVoiceKey = (typeof TTS_VOICE_KEYS)[number];

export const TTS_VOICE_LABEL: Record<TtsVoiceKey, string> = {
  abong: "아봉",
  asmr: "ASMR",
  dukchan: "덕찬",
  changu: "찬구",
  changsu: "창수",
  letter: "래터",
  kiri: "키리",
  sukhee: "숙희",
};

export function isTtsVoiceKey(s: string): s is TtsVoiceKey {
  return (TTS_VOICE_KEYS as readonly string[]).includes(s);
}

export interface IUserSetting extends Document {
  guildId: string;
  userId: string;
  voice: TtsVoiceKey;
  /** TTS 트리거 시 본인 메시지 삭제 여부 (유저별) */
  deleteUserMessage: boolean;
}

const userSettingSchema = new Schema<IUserSetting>(
  {
    guildId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    voice: {
      type: String,
      required: true,
      enum: [...TTS_VOICE_KEYS],
      default: "abong",
    },
    deleteUserMessage: { type: Boolean, required: true, default: false },
  },
  { timestamps: true }
);

userSettingSchema.index({ guildId: 1, userId: 1 }, { unique: true });

export const UserSettingModel = model<IUserSetting>("UserSetting", userSettingSchema);
