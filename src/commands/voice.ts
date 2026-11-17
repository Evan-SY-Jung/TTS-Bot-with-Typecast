import { InteractionContextType, MessageFlags, SlashCommandBuilder } from "discord.js";
import { type Command, suggestVoices } from "./types.ts";

export const voice: Command = {
  data: new SlashCommandBuilder()
    .setName("voice")
    .setDescription("TTS 읽기 목소리 선택")
    .setContexts(InteractionContextType.Guild)
    .addStringOption((option) =>
      option.setName("speaker").setDescription("목소리").setRequired(true).setAutocomplete(true),
    ),

  autocomplete: suggestVoices,

  async execute(interaction, ctx) {
    const chosen = ctx.voices.find(interaction.options.getString("speaker", true));
    if (!chosen) {
      return interaction.reply({
        content: "그런 목소리는 없어요. 입력할 때 뜨는 목록에서 골라 주세요.",
        flags: MessageFlags.Ephemeral,
      });
    }

    ctx.userSettings.setVoice(interaction.guildId, interaction.user.id, chosen.key);
    return interaction.reply({
      content: `TTS 목소리를 「${chosen.label}」로 설정했어요.`,
      flags: MessageFlags.Ephemeral,
    });
  },
};
