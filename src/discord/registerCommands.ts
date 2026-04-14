import { REST, Routes, SlashCommandBuilder } from "discord.js";
import { TTS_VOICE_KEYS, TTS_VOICE_LABEL } from "../db/models/UserSetting";
import { getConfig } from "../config";

export async function registerCommands(): Promise<void> {
  const config = getConfig();
  const { discordBotToken, discordClientId, discordGuildId } = config;

  if (!discordClientId) {
    console.warn(
      "DISCORD_CLIENT_ID 가 비어있어서 슬래시 커맨드 등록을 스킵합니다. " +
        "환경변수에 DISCORD_CLIENT_ID를 넣고 다시 실행하세요."
    );
    return;
  }

  const voiceChoices = TTS_VOICE_KEYS.map((key) => ({
    name: TTS_VOICE_LABEL[key],
    value: key,
  }));

  const commands = [
    new SlashCommandBuilder()
      .setName("voice")
      .setDescription("TTS 읽기 목소리 선택")
      .addStringOption((opt) =>
        opt
          .setName("speaker")
          .setDescription("목소리")
          .setRequired(true)
          .addChoices(...voiceChoices)
      )
      .toJSON(),

    new SlashCommandBuilder()
      .setName("tts-delete")
      .setDescription("본인 TTS 트리거 메시지 삭제 on/off (본인에게만 적용)")
      .addStringOption((opt) =>
        opt
          .setName("mode")
          .setDescription("삭제 on/off")
          .setRequired(true)
          .addChoices(
            { name: "on", value: "on" },
            { name: "off", value: "off" }
          )
      )
      .toJSON(),
  ];

  const rest = new REST({ version: "10" }).setToken(discordBotToken);

  const route = discordGuildId
    ? Routes.applicationGuildCommands(discordClientId, discordGuildId)
    : Routes.applicationCommands(discordClientId);

  await rest.put(route, { body: commands });
  console.log(
    `Slash commands registered (${discordGuildId ? "guild" : "global"}): ${commands
      .map((c) => c.name)
      .join(", ")}`
  );
}
