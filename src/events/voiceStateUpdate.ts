import { type Client, Events } from "discord.js";
import { getConnection } from "../tts/player.ts";

/**
 * 봇은 재생이 끝나도 음성 채널에 남아 있는다.
 * 그 채널에 사람이 한 명도 없게 되면(봇만 남으면) 나간다.
 */
export function registerVoiceStateUpdate(client: Client): void {
  client.on(Events.VoiceStateUpdate, (oldState) => {
    const { guild } = oldState;
    const connection = getConnection(guild.client.user.id, guild.id);
    const channelId = connection?.joinConfig.channelId;
    if (!connection || !channelId) return;

    const channel = guild.channels.cache.get(channelId);
    if (!channel?.isVoiceBased()) return;

    if (channel.members.every((member) => member.user.bot)) connection.destroy();
  });
}
