import { UserSettingModel, TTS_VOICE_KEYS } from "./models/UserSetting";

/**
 * - voice 필드 없음 / null → abong
 * - 예전 스키마 기본값 dukchan → abong (신규 기본은 아봉)
 * - 허용 목록에 없는 값 → abong
 * - 환경변수 TTS_RESET_ALL_VOICES_TO_ABONG=1 이면 전원 abong (초기화에 가깝게)
 */
export async function runVoiceDefaultMigration(): Promise<void> {
  const valid = [...TTS_VOICE_KEYS];

  if (process.env.TTS_RESET_ALL_VOICES_TO_ABONG === "1") {
    const r = await UserSettingModel.updateMany({}, { $set: { voice: "abong" } });
    console.log(
      `UserSetting: TTS_RESET_ALL_VOICES_TO_ABONG=1 → 전체 voice 를 abong 으로 설정 (${r.modifiedCount}건 수정)`
    );
    return;
  }

  const missing = await UserSettingModel.updateMany(
    { $or: [{ voice: { $exists: false } }, { voice: null }] },
    { $set: { voice: "abong" } }
  );

  const oldDefault = await UserSettingModel.updateMany(
    { voice: "dukchan" },
    { $set: { voice: "abong" } }
  );

  const invalid = await UserSettingModel.updateMany(
    { voice: { $nin: valid } },
    { $set: { voice: "abong" } }
  );

  const total = missing.modifiedCount + oldDefault.modifiedCount + invalid.modifiedCount;
  if (total > 0) {
    console.log(
      `UserSetting 마이그레이션: voice 없음 ${missing.modifiedCount}건, dukchan→abong ${oldDefault.modifiedCount}건, 잘못된 값 수정 ${invalid.modifiedCount}건`
    );
  }
}
