import { VoiceBasedChannel, VoiceChannel } from "discord.js";
import {
  AudioPlayerStatus,
  createAudioPlayer,
  createAudioResource,
  joinVoiceChannel,
  StreamType,
  VoiceConnectionStatus,
  type PlayerSubscription,
} from "@discordjs/voice";
import { Readable } from "stream";
import type { TtsVoiceKey } from "../db/models/UserSetting";
import { synthesizeTypecastForPlayback } from "./typecastTts";

export type PlayTtsInput = {
  voiceChannel: VoiceBasedChannel | VoiceChannel;
  text: string;
  voiceKey: TtsVoiceKey;
};

/** 재생 루틴이 `error` 리스너를 떼면, 남은 연결에서 나는 오류가 unhandled 가 되지 않게 */
function onVoiceErrorWhileIdle(err: Error) {
  console.warn("VoiceConnection error (재생 종료 후·연결 유지 중):", err.message);
}

export async function playTtsToVoiceChannel(input: PlayTtsInput): Promise<void> {
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
  const connection = joinVoiceChannel({
    guildId,
    channelId,
    adapterCreator,
  });

  connection.off("error", onVoiceErrorWhileIdle);

  let destroyAfterPlayback = false;
  let playbackStarted = false;
  let finishPlayback: (() => void) | null = null;

  const onConnectionError = (err: Error) => {
    console.error("VoiceConnection error (DNS ENOTFOUND·521 등 일시 오류일 수 있음):", err);
    if (!playbackStarted) {
      connection.off("error", onConnectionError);
      try {
        connection.destroy();
      } catch {}
      return;
    }
    destroyAfterPlayback = true;
    finishPlayback?.();
  };

  connection.on("error", onConnectionError);

  let audioBuffer: Buffer;
  let streamType: StreamType;
  try {
    const r = await synthesizeTypecastForPlayback(text, voiceKey);
    audioBuffer = r.buffer;
    streamType = r.streamType;
  } catch (e) {
    connection.off("error", onConnectionError);
    try {
      connection.destroy();
    } catch {}
    throw e;
  }

  if (connection.state.status === VoiceConnectionStatus.Destroyed) {
    connection.off("error", onConnectionError);
    throw new Error("TTS_VOICE_CONNECTION_LOST");
  }

  const player = createAudioPlayer();
  const subscription: PlayerSubscription | undefined = connection.subscribe(player) ?? undefined;

  const resource = createAudioResource(Readable.from(audioBuffer), {
    inputType: streamType,
  });

  return await new Promise<void>((resolve) => {
    let settled = false;

    const cleanup = () => {
      if (settled) return;
      settled = true;

      connection.off(VoiceConnectionStatus.Disconnected, finish);
      connection.off("error", onConnectionError);

      try {
        subscription?.unsubscribe();
      } catch {}

      try {
        player.stop(true);
      } catch {}

      if (destroyAfterPlayback) {
        try {
          connection.destroy();
        } catch {}
      } else {
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

    connection.on(VoiceConnectionStatus.Disconnected, finish);

    player.once(AudioPlayerStatus.Idle, finish);
    player.once("error", (err) => {
      console.error("AudioPlayer error:", err);
      finish();
    });

    player.play(resource);
  });
}
