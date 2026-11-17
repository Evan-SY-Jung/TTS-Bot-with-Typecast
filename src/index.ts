import { Client, Events, GatewayIntentBits } from "discord.js";
import { loadConfig } from "./config.ts";
import type { AppContext } from "./context.ts";
import { createGuildSettings } from "./db/guildSettings.ts";
import { openDatabase } from "./db/index.ts";
import { createUserSettings } from "./db/userSettings.ts";
import { registerEvents } from "./events/index.ts";
import { destroyAllConnections } from "./tts/player.ts";
import { createSynthesizer } from "./tts/typecast.ts";
import { loadVoiceCatalog } from "./tts/voices.ts";

const config = loadConfig();
const voices = loadVoiceCatalog(config.voicesPath, process.env, config.defaultVoice);
const db = openDatabase(config.databasePath);

const ctx: AppContext = {
  config,
  voices,
  guildSettings: createGuildSettings(db),
  userSettings: createUserSettings(db),
  synthesize: createSynthesizer(config),
  bots: [],
};

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[bot] ${signal} 수신, 종료합니다.`);

  for (const bot of ctx.bots) {
    if (bot.isReady()) destroyAllConnections(bot.user.id);
    await bot.destroy().catch(() => {});
  }
  db.close();
  process.exit(0);
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.on("unhandledRejection", (reason) => console.error("[bot] 처리되지 않은 오류:", reason));

try {
  // 토큰 순서대로 로그인한다. 읽을 봇을 고를 때도 이 순서가 우선순위다.
  for (const token of config.botTokens) {
    const bot = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
      ],
    });
    registerEvents(bot, ctx);
    bot.once(Events.ClientReady, (ready) => {
      console.log(`[bot] ${ready.user.tag} 로그인 (서버 ${ready.guilds.cache.size}곳)`);
    });
    ctx.bots.push(bot);
    await bot.login(token);
  }

  console.log(`[bot] 봇 ${ctx.bots.length}개 실행 중, 목소리 ${voices.all.length}종`);
} catch (err) {
  console.error("[bot] 시작 실패:", err);
  process.exit(1);
}
