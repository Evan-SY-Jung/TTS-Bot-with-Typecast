import {
  ChannelType,
  channelMention,
  InteractionContextType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { type Command, suggestVoices } from "./types.ts";

/** 텍스트 채널과, 음성 채널에 딸린 채팅을 TTS 채널로 쓸 수 있다. */
const CHANNEL_TYPES = [ChannelType.GuildText, ChannelType.GuildVoice, ChannelType.GuildStageVoice] as const;

/** 서버 관리자용 설정 커맨드 */
export const tts: Command = {
  data: new SlashCommandBuilder()
    .setName("tts")
    .setDescription("TTS 서버 설정 (관리자용)")
    .setContexts(InteractionContextType.Guild)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommandGroup((group) =>
      group
        .setName("channel")
        .setDescription("메시지를 읽어 줄 채널 관리")
        .addSubcommand((sub) =>
          sub
            .setName("add")
            .setDescription("TTS 채널 등록")
            .addChannelOption((option) =>
              option
                .setName("channel")
                .setDescription("등록할 채널 (비우면 지금 채널)")
                .addChannelTypes(...CHANNEL_TYPES),
            ),
        )
        .addSubcommand((sub) =>
          sub
            .setName("remove")
            .setDescription("TTS 채널 해제")
            .addChannelOption((option) =>
              option
                .setName("channel")
                .setDescription("해제할 채널 (비우면 지금 채널)")
                .addChannelTypes(...CHANNEL_TYPES),
            ),
        )
        .addSubcommand((sub) => sub.setName("list").setDescription("등록된 TTS 채널 보기")),
    )
    .addSubcommand((sub) =>
      sub
        .setName("default-voice")
        .setDescription("목소리를 고르지 않은 사람에게 쓸 서버 기본 목소리")
        .addStringOption((option) =>
          option.setName("speaker").setDescription("목소리").setRequired(true).setAutocomplete(true),
        ),
    ),

  autocomplete: suggestVoices,

  async execute(interaction, ctx) {
    const { guildId, options } = interaction;
    const reply = (content: string) => interaction.reply({ content, flags: MessageFlags.Ephemeral });

    if (options.getSubcommand() === "default-voice") {
      const chosen = ctx.voices.find(options.getString("speaker", true));
      if (!chosen) return reply("그런 목소리는 없어요. 입력할 때 뜨는 목록에서 골라 주세요.");

      ctx.guildSettings.setDefaultVoice(guildId, chosen.key);
      return reply(`이 서버의 기본 목소리를 「${chosen.label}」로 설정했어요.`);
    }

    // channel add | remove | list
    const channelId = options.getChannel("channel")?.id ?? interaction.channelId;

    switch (options.getSubcommand()) {
      case "add":
        return reply(
          ctx.guildSettings.addChannel(guildId, channelId)
            ? `${channelMention(channelId)} 채널의 메시지를 읽어 드릴게요.`
            : `${channelMention(channelId)} 채널은 이미 등록되어 있어요.`,
        );
      case "remove":
        return reply(
          ctx.guildSettings.removeChannel(channelId)
            ? `${channelMention(channelId)} 채널을 해제했어요.`
            : `${channelMention(channelId)} 채널은 등록되어 있지 않아요.`,
        );
      default: {
        const channels = ctx.guildSettings.listChannels(guildId);
        return reply(
          channels.length > 0
            ? `TTS 채널: ${channels.map(channelMention).join(", ")}`
            : "등록된 TTS 채널이 없어요. `/tts channel add` 로 등록해 주세요.",
        );
      }
    }
  },
};
