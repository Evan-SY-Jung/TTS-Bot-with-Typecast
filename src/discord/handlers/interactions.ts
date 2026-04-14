import {
  ApplicationCommandOptionType,
  ChatInputCommandInteraction,
  Client,
} from "discord.js";
import {
  UserSettingModel,
  TTS_VOICE_LABEL,
  isTtsVoiceKey,
  type TtsVoiceKey,
} from "../../db/models/UserSetting";

function getSlashSpeakerChoice(interaction: ChatInputCommandInteraction): string | null {
  for (const opt of interaction.options.data) {
    if (opt.type !== ApplicationCommandOptionType.String) continue;
    if (opt.name !== "speaker") continue;
    const v = opt.value;
    if (typeof v === "string" && isTtsVoiceKey(v)) return v;
  }
  return interaction.options.getString("speaker", false);
}

async function replyInteractionError(interaction: ChatInputCommandInteraction, content: string) {
  if (interaction.deferred) {
    await interaction.editReply({ content }).catch(() => {});
  } else if (interaction.replied) {
    await interaction.followUp({ content, ephemeral: true }).catch(() => {});
  } else {
    await interaction.reply({ content, ephemeral: true }).catch(() => {});
  }
}

async function handleVoice(interaction: ChatInputCommandInteraction) {
  try {
    await interaction.deferReply({ ephemeral: true });
  } catch (e) {
    console.error(
      "deferReply 실패(3초 초과·토큰 만료·다른 프로세스가 이미 응답했을 수 있음):",
      e
    );
    return;
  }

  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.editReply({ content: "서버 안에서만 사용할 수 있어요." });
    return;
  }

  const raw = getSlashSpeakerChoice(interaction);
  if (!raw || !isTtsVoiceKey(raw)) {
    await interaction.editReply({
      content:
        "목소리 옵션을 찾을 수 없어요. 봇을 재시작해 슬래시 커맨드를 다시 등록했는지 확인해 주세요.",
    });
    return;
  }

  const voice: TtsVoiceKey = raw;

  await UserSettingModel.findOneAndUpdate(
    { guildId, userId: interaction.user.id },
    { $set: { voice } },
    { upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );

  const label = TTS_VOICE_LABEL[voice];
  await interaction.editReply({ content: `TTS 목소리를 「${label}」로 설정했어요.` });
}

async function handleTtsDelete(interaction: ChatInputCommandInteraction) {
  try {
    await interaction.deferReply({ ephemeral: true });
  } catch (e) {
    console.error("deferReply 실패:", e);
    return;
  }

  const guildId = interaction.guildId;
  const channelId = interaction.channelId;
  if (!guildId || !channelId) {
    await interaction.editReply({ content: "서버/채널 안에서만 사용할 수 있어요." });
    return;
  }

  const mode = interaction.options.getString("mode", false);
  if (!mode) {
    await interaction.editReply({ content: "mode 옵션을 찾을 수 없어요." });
    return;
  }
  const deleteUserMessage = mode === "on";

  await UserSettingModel.findOneAndUpdate(
    { guildId, userId: interaction.user.id },
    { $set: { deleteUserMessage } },
    { upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );

  await interaction.editReply({
    content: `본인 TTS 트리거 메시지 삭제를 '${mode}' 로 설정했어요. (본인에게만 적용)`,
  });
}

export function setupInteractionHandlers(client: Client) {
  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    try {
      switch (interaction.commandName) {
        case "voice":
          await handleVoice(interaction);
          break;
        case "tts-delete":
          await handleTtsDelete(interaction);
          break;
        default:
          await interaction.reply({ content: "알 수 없는 커맨드입니다.", ephemeral: true });
      }
    } catch (err) {
      console.error("Interaction error:", err);
      const msg = err instanceof Error ? err.message : "알 수 없는 오류";
      if (interaction.isRepliable()) {
        await replyInteractionError(interaction, `오류: ${msg}`);
      }
    }
  });
}
