"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupVoiceIdleDisconnect = setupVoiceIdleDisconnect;
const discord_js_1 = require("discord.js");
const voice_1 = require("@discordjs/voice");
/**
 * 봇이 들어간 음성 채널에 사람(비봇)이 없을 때만 음성 연결을 끊습니다.
 * TTS 재생이 끝난 뒤에도 연결을 유지하고, 빈 방일 때만 퇴장합니다.
 */
function setupVoiceIdleDisconnect(client) {
    client.on(discord_js_1.Events.VoiceStateUpdate, (_oldState, newState) => {
        const guild = newState.guild;
        const connection = (0, voice_1.getVoiceConnection)(guild.id);
        if (!connection)
            return;
        const channelId = connection.joinConfig.channelId;
        if (!channelId)
            return;
        const channel = guild.channels.cache.get(channelId);
        if (!channel?.isVoiceBased())
            return;
        const voiceChannel = channel;
        const humanCount = voiceChannel.members.filter((m) => !m.user.bot).size;
        if (humanCount === 0) {
            connection.destroy();
        }
    });
}
