import { Client, Events, VoiceBasedChannel } from "discord.js";
import { getVoiceConnection } from "@discordjs/voice";

/**
 * 봇이 들어간 음성 채널에 사람(비봇)이 없을 때만 음성 연결을 끊습니다.
 * TTS 재생이 끝난 뒤에도 연결을 유지하고, 빈 방일 때만 퇴장합니다.
 */
export function setupVoiceIdleDisconnect(client: Client) {
  client.on(Events.VoiceStateUpdate, (_oldState, newState) => {
    const guild = newState.guild;
    const connection = getVoiceConnection(guild.id);
    if (!connection) return;

    const channelId = connection.joinConfig.channelId;
    if (!channelId) return;

    const channel = guild.channels.cache.get(channelId);
    if (!channel?.isVoiceBased()) return;

    const voiceChannel = channel as VoiceBasedChannel;
    const humanCount = voiceChannel.members.filter((m) => !m.user.bot).size;
    if (humanCount === 0) {
      connection.destroy();
    }
  });
}
