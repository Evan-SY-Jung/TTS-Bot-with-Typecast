"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.playTtsToVoiceChannel = playTtsToVoiceChannel;
const voice_1 = require("@discordjs/voice");
const stream_1 = require("stream");
const typecastTts_1 = require("./typecastTts");
/** 재생 루틴이 `error` 리스너를 떼면, 남은 연결에서 나는 오류가 unhandled 가 되지 않게 */
function onVoiceErrorWhileIdle(err) {
    console.warn("VoiceConnection error (재생 종료 후·연결 유지 중):", err.message);
}
async function playTtsToVoiceChannel(input) {
    const { voiceChannel, text, voiceKey } = input;
    const guildId = voiceChannel.guildId ?? voiceChannel.guild?.id;
    const channelId = voiceChannel.id;
    const adapterCreator = voiceChannel.guild.voiceAdapterCreator;
    if (!guildId) {
        throw new Error("voiceChannel.guildId를 가져올 수 없습니다.");
    }
    /**
     * Typecast 합성은 수 초 걸릴 수 있음. 그동안 길드에 남아 있는 VoiceConnection 이 WebSocket DNS 등으로
     * `error` 를 내면 리스너가 없을 때 Node 가 프로세스를 죽임 → 연결·리스너를 합성보다 먼저 잡는다.
     */
    const connection = (0, voice_1.joinVoiceChannel)({
        guildId,
        channelId,
        adapterCreator,
    });
    connection.off("error", onVoiceErrorWhileIdle);
    let destroyAfterPlayback = false;
    let playbackStarted = false;
    let finishPlayback = null;
    const onConnectionError = (err) => {
        console.error("VoiceConnection error (DNS ENOTFOUND·521 등 일시 오류일 수 있음):", err);
        if (!playbackStarted) {
            connection.off("error", onConnectionError);
            try {
                connection.destroy();
            }
            catch { }
            return;
        }
        destroyAfterPlayback = true;
        finishPlayback?.();
    };
    connection.on("error", onConnectionError);
    let audioBuffer;
    let streamType;
    try {
        const r = await (0, typecastTts_1.synthesizeTypecastForPlayback)(text, voiceKey);
        audioBuffer = r.buffer;
        streamType = r.streamType;
    }
    catch (e) {
        connection.off("error", onConnectionError);
        try {
            connection.destroy();
        }
        catch { }
        throw e;
    }
    if (connection.state.status === voice_1.VoiceConnectionStatus.Destroyed) {
        connection.off("error", onConnectionError);
        throw new Error("TTS_VOICE_CONNECTION_LOST");
    }
    const player = (0, voice_1.createAudioPlayer)();
    const subscription = connection.subscribe(player) ?? undefined;
    const resource = (0, voice_1.createAudioResource)(stream_1.Readable.from(audioBuffer), {
        inputType: streamType,
    });
    return await new Promise((resolve) => {
        let settled = false;
        const cleanup = () => {
            if (settled)
                return;
            settled = true;
            connection.off(voice_1.VoiceConnectionStatus.Disconnected, finish);
            connection.off("error", onConnectionError);
            try {
                subscription?.unsubscribe();
            }
            catch { }
            try {
                player.stop(true);
            }
            catch { }
            if (destroyAfterPlayback) {
                try {
                    connection.destroy();
                }
                catch { }
            }
            else {
                connection.off("error", onVoiceErrorWhileIdle);
                connection.on("error", onVoiceErrorWhileIdle);
            }
            finishPlayback = null;
            resolve();
        };
        const timeoutMs = 120_000;
        const timer = setTimeout(cleanup, timeoutMs);
        const finish = () => {
            clearTimeout(timer);
            cleanup();
        };
        finishPlayback = finish;
        playbackStarted = true;
        connection.on(voice_1.VoiceConnectionStatus.Disconnected, finish);
        player.once(voice_1.AudioPlayerStatus.Idle, finish);
        player.once("error", (err) => {
            console.error("AudioPlayer error:", err);
            finish();
        });
        player.play(resource);
    });
}
