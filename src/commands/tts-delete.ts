import { InteractionContextType, MessageFlags, SlashCommandBuilder } from "discord.js";
import type { Command } from "./types.ts";

export const ttsDelete: Command = {
  data: new SlashCommandBuilder()
    .setName("tts-delete")
    .setDescription("TTS로 읽은 본인 메시지 삭제 on/off (본인에게만 적용)")
    .setContexts(InteractionContextType.Guild)
    .addStringOption((option) =>
      option
        .setName("mode")
        .setDescription("삭제 on/off")
        .setRequired(true)
        .addChoices({ name: "on", value: "on" }, { name: "off", value: "off" }),
    ),

  async execute(interaction, ctx) {
    const mode = interaction.options.getString("mode", true);
    ctx.userSettings.setDeleteUserMessage(interaction.guildId, interaction.user.id, mode === "on");

    return interaction.reply({
      content: `본인 TTS 메시지 삭제를 '${mode}' 로 설정했어요. (본인에게만 적용)`,
      flags: MessageFlags.Ephemeral,
    });
  },
};
