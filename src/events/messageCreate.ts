import { type Client, Events, type Message, userMention } from "discord.js";
import { isGuildAllowed } from "../config.ts";
import type { AppContext } from "../context.ts";
import { describeTtsError } from "../tts/errors.ts";
import { pickBot } from "../tts/pickBot.ts";
import { isSpeaking, speak } from "../tts/player.ts";
import { hasSpeakableText, prepareText } from "../tts/text.ts";

/**
 * 같은 서버에 봇이 둘 다 있으면 메시지 하나가 봇마다 한 번씩 들어온다.
 * 먼저 받은 쪽만 처리한다. 실제로 읽을 봇은 pickBot 이 따로 고른다.
 */
const claimed = new Set<string>();
function claim(messageId: string): boolean {
  if (claimed.has(messageId)) return false;
  claimed.add(messageId);
  setTimeout(() => claimed.delete(messageId), 60_000).unref();
  return true;
}

/** 잠깐 떴다가 사라지는 안내. 원본 메시지가 지워졌을 수 있어서 답장이 아니라 일반 메시지로 보낸다. */
async function notify(message: Message<true>, text: string, ttlMs: number): Promise<void> {
  const notice = await message.channel
    .send({ content: `${userMention(message.author.id)} ${text}`, allowedMentions: { parse: [] } })
    .catch(() => null);
  if (notice) setTimeout(() => notice.delete().catch(() => {}), ttlMs).unref();
}

async function handleMessage(message: Message, ctx: AppContext): Promise<void> {
  if (message.author.bot || !message.inGuild()) return;
  if (!ctx.guildSettings.isTtsChannel(message.channelId)) return;
  if (!isGuildAllowed(ctx.config, message.guildId)) return;
  if (!claim(message.id)) return;

  const { guildId, author } = message;
  const settings = ctx.userSettings.get(guildId, author.id);
  const say = (text: string) => notify(message, text, ctx.config.noticeTtlMs);
  const removeTrigger = async () => {
    if (settings.deleteUserMessage) await message.delete().catch(() => {});
  };

  const member = message.member ?? (await message.guild.members.fetch(author.id).catch(() => null));
  const voiceChannelId = member?.voice.channelId;
  if (!voiceChannelId) {
    await removeTrigger();
    return say("음성 채널에 먼저 접속한 뒤 다시 메시지를 보내주세요.");
  }

  const text = prepareText(message.cleanContent, ctx.config.maxChars);

  // 여기부터 speak() 호출까지는 await 가 없어야 한다. 재생 중 확인과 잠금 사이에 다른 메시지가 끼어들지 않게.
  const guild = pickBot(ctx.bots, guildId, voiceChannelId);
  if (guild === "in-use") {
    await removeTrigger();
    return say("지금은 TTS 봇이 모두 다른 음성 채널에서 사용 중이에요.");
  }
  if (guild === "cannot-join") {
    await removeTrigger();
    return say("봇이 그 음성 채널에 들어갈 권한이 없어요.");
  }

  // 재생 중에 온 메시지는 읽지 않고 넘긴다. 메시지 삭제를 켠 사람에게만 알려 준다.
  if (isSpeaking(guild.client.user.id, guildId)) {
    if (settings.deleteUserMessage) {
      await removeTrigger();
      return say("현재 TTS를 재생 중이라 이 메시지는 읽지 못했어요.");
    }
    return;
  }

  if (!hasSpeakableText(text)) {
    await removeTrigger();
    return say("글자나 숫자가 들어간 말만 읽을 수 있어요.");
  }

  const voice = ctx.voices.resolve(settings.voice, ctx.guildSettings.getDefaultVoice(guildId));
  const playback = speak({
    guild,
    voiceChannelId,
    synthesize: () => ctx.synthesize(text, voice.voiceId),
  });
  void removeTrigger();

  try {
    await playback;
  } catch (err) {
    console.error("[tts] 재생 실패:", err);
    await say(describeTtsError(err));
  }
}

export function registerMessageCreate(client: Client, ctx: AppContext): void {
  client.on(Events.MessageCreate, (message) => {
    handleMessage(message, ctx).catch((err) => console.error("[tts] 메시지 처리 오류:", err));
  });
}
