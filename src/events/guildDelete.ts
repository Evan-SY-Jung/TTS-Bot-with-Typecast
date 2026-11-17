import { type Client, Events } from "discord.js";
import type { AppContext } from "../context.ts";

/** 서버에서 봇이 모두 빠지면 그 서버의 설정을 지운다. */
export function registerGuildDelete(client: Client, ctx: AppContext): void {
  client.on(Events.GuildDelete, (guild) => {
    // 디스코드 장애로 잠깐 안 보이는 경우는 건드리지 않는다.
    if (!guild.available) return;
    // 다른 봇이 아직 이 서버에 남아 있으면 설정을 유지한다.
    if (ctx.bots.some((bot) => bot.guilds.cache.has(guild.id))) return;

    ctx.guildSettings.deleteGuild(guild.id);
    ctx.userSettings.deleteGuild(guild.id);
    console.log(`[guild] ${guild.name} (${guild.id}) 에서 나와서 설정을 지웠습니다.`);
  });
}
