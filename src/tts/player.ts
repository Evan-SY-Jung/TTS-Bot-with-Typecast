import type { Readable } from "node:stream";
import {
  AudioPlayerStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
  getVoiceConnection,
  getVoiceConnections,
  joinVoiceChannel,
  StreamType,
  type VoiceConnection,
  type VoiceConnectionState,
  VoiceConnectionStatus,
} from "@discordjs/voice";
import type { Guild } from "discord.js";
import { TtsError } from "./errors.ts";

const CONNECT_TIMEOUT_MS = 15_000;
const PLAYBACK_TIMEOUT_MS = 120_000;
const RECONNECT_GRACE_MS = 5_000;

/**
 * 봇이 여러 개라 같은 서버에 음성 연결이 여러 개 생길 수 있다.
 * @discordjs/voice 의 group 을 봇 ID로 써서 봇마다 연결을 따로 관리한다.
 */
export function getConnection(botId: string, guildId: string): VoiceConnection | undefined {
  return getVoiceConnection(guildId, botId);
}

export function destroyAllConnections(botId: string): void {
  for (const connection of getVoiceConnections(botId)?.values() ?? []) connection.destroy();
}

const speaking = new Set<string>();
const lockKey = (botId: string, guildId: string) => `${botId}:${guildId}`;

export function isSpeaking(botId: string, guildId: string): boolean {
  return speaking.has(lockKey(botId, guildId));
}

const prepared = new WeakSet<VoiceConnection>();

/** 연결마다 한 번만 붙이는 리스너. 재생이 끝난 뒤에도 연결은 유지되므로 계속 남겨 둔다. */
function prepare(connection: VoiceConnection): void {
  if (prepared.has(connection)) return;
  prepared.add(connection);

  // error 리스너가 없으면 일시적인 네트워크 오류(DNS 실패 등)에도 프로세스가 죽는다.
  connection.on("error", (err) => console.warn("[voice] 연결 오류:", err.message));

  // 채널 이동이면 곧 다시 연결되고, 강제 퇴장이면 그대로 끊긴다. 후자일 때 연결을 정리한다.
  connection.on(VoiceConnectionStatus.Disconnected, async () => {
    try {
      await Promise.race([
        entersState(connection, VoiceConnectionStatus.Signalling, RECONNECT_GRACE_MS),
        entersState(connection, VoiceConnectionStatus.Connecting, RECONNECT_GRACE_MS),
      ]);
    } catch {
      if (connection.state.status !== VoiceConnectionStatus.Destroyed) connection.destroy();
    }
  });
}

/** 연결이 파괴되거나 시간이 지나면 중단되는 신호 */
function untilDestroyedOrTimeout(connection: VoiceConnection, timeoutMs: number) {
  const destroyed = new AbortController();
  const onStateChange = (_old: VoiceConnectionState, next: VoiceConnectionState) => {
    if (next.status === VoiceConnectionStatus.Destroyed) destroyed.abort();
  };
  connection.on("stateChange", onStateChange);
  if (connection.state.status === VoiceConnectionStatus.Destroyed) destroyed.abort();

  return {
    signal: AbortSignal.any([destroyed.signal, AbortSignal.timeout(timeoutMs)]),
    dispose: () => connection.off("stateChange", onStateChange),
  };
}

export interface SpeakOptions {
  /** 재생할 봇 기준의 Guild 객체 (guild.client 가 그 봇) */
  guild: Guild;
  voiceChannelId: string;
  /** 오디오 스트림을 만든다. 음성 연결과 동시에 진행된다. */
  synthesize: () => Promise<Readable>;
}

/**
 * 음성 채널에 들어가(이미 있으면 그대로) 오디오를 끝까지 재생한다.
 * 재생이 끝나도 채널에 남는다. 퇴장은 events/voiceStateUpdate.ts 가 맡는다.
 * 같은 봇이 같은 서버에서 이미 재생 중이면 BUSY 를 던진다.
 */
export async function speak({ guild, voiceChannelId, synthesize }: SpeakOptions): Promise<void> {
  const botId = guild.client.user.id;
  const key = lockKey(botId, guild.id);
  if (speaking.has(key)) throw new TtsError("BUSY");
  speaking.add(key);

  try {
    const connection = joinVoiceChannel({
      guildId: guild.id,
      channelId: voiceChannelId,
      adapterCreator: guild.voiceAdapterCreator,
      group: botId,
    });
    prepare(connection);

    // 합성은 몇 초 걸릴 수 있으니 음성 연결과 동시에 진행한다.
    const connecting = untilDestroyedOrTimeout(connection, CONNECT_TIMEOUT_MS);
    const [audio, ready] = await Promise.allSettled([
      synthesize(),
      entersState(connection, VoiceConnectionStatus.Ready, connecting.signal),
    ]);
    connecting.dispose();

    if (ready.status === "rejected") {
      if (audio.status === "fulfilled") audio.value.destroy();
      if (connection.state.status !== VoiceConnectionStatus.Destroyed) connection.destroy();
      throw new TtsError("VOICE_CONNECTION_FAILED", { cause: ready.reason });
    }
    if (audio.status === "rejected") throw audio.reason;

    await play(connection, audio.value);
  } finally {
    speaking.delete(key);
  }
}

async function play(connection: VoiceConnection, audio: Readable): Promise<void> {
  const player = createAudioPlayer();
  player.on("error", (err) => console.error("[voice] 재생 오류:", err.message));
  const subscription = connection.subscribe(player);
  const playing = untilDestroyedOrTimeout(connection, PLAYBACK_TIMEOUT_MS);

  try {
    // mp3/wav 는 Opus 가 아니라서 FFmpeg 변환을 거친다(ffmpeg-static).
    player.play(createAudioResource(audio, { inputType: StreamType.Arbitrary }));
    await entersState(player, AudioPlayerStatus.Idle, playing.signal);
  } catch {
    // 연결이 끊겼거나, 제한 시간을 넘겼거나, 재생 오류(위에서 기록)가 난 경우. 어느 쪽이든 여기서 끝낸다.
  } finally {
    playing.dispose();
    subscription?.unsubscribe();
    player.stop(true);
    audio.destroy();
  }
}
