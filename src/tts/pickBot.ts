import type { Client, Guild } from "discord.js";
import { getConnection } from "./player.ts";

export interface BotCandidate<T> {
  bot: T;
  /** 이 봇이 지금 연결해 있는 음성 채널. 없으면 null */
  connectedChannelId: string | null;
  /** 이 봇이 대상 음성 채널에 들어갈 수 있는지 */
  canJoin: boolean;
}

/** in-use: 봇이 모두 다른 채널에서 사용 중 / cannot-join: 남는 봇은 있지만 채널 권한이 없음 */
export type NoBotReason = "in-use" | "cannot-join";

/**
 * 메시지를 읽을 봇을 고른다.
 * 1) 이미 그 음성 채널에 있는 봇
 * 2) 어느 채널에도 없는 봇 중 그 채널에 들어갈 수 있는 봇
 * 다른 채널에서 쓰이고 있는 봇은 끌어오지 않는다.
 */
export function chooseBot<T>(candidates: BotCandidate<T>[], voiceChannelId: string): T | NoBotReason {
  const present = candidates.find((c) => c.connectedChannelId === voiceChannelId);
  if (present) return present.bot;

  const idle = candidates.filter((c) => c.connectedChannelId === null);
  if (idle.length === 0) return "in-use";
  return idle.find((c) => c.canJoin)?.bot ?? "cannot-join";
}

/** 선택된 봇 기준의 Guild 객체를 돌려준다. */
export function pickBot(bots: Client[], guildId: string, voiceChannelId: string): Guild | NoBotReason {
  const candidates: BotCandidate<Guild>[] = [];

  for (const bot of bots) {
    if (!bot.isReady()) continue;
    const guild = bot.guilds.cache.get(guildId);
    if (!guild) continue;

    const channel = guild.channels.cache.get(voiceChannelId);
    candidates.push({
      bot: guild,
      connectedChannelId: getConnection(bot.user.id, guildId)?.joinConfig.channelId ?? null,
      canJoin: channel?.isVoiceBased() === true && channel.joinable,
    });
  }

  return chooseBot(candidates, voiceChannelId);
}
