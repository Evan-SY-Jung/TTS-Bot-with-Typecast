/**
 * 슬래시 커맨드를 전역으로 등록한다. 커맨드 구성을 바꿨을 때만 실행하면 된다.
 *
 *   npm run deploy-commands
 *
 * 예전 버전은 DISCORD_GUILD_ID 서버에만 커맨드를 등록했다. 그 값이 .env 에 남아 있으면
 * 그 서버 전용 커맨드를 지워서 전역 커맨드와 겹쳐 보이지 않게 한다.
 */
import { REST, type RESTGetCurrentApplicationResult, Routes } from "discord.js";
import { commands } from "./commands/index.ts";
import { loadConfig } from "./config.ts";

const { botTokens } = loadConfig();
const legacyGuildId = process.env.DISCORD_GUILD_ID?.trim();
const body = [...commands.values()].map((command) => command.data.toJSON());

for (const token of botTokens) {
  const rest = new REST().setToken(token);
  const app = (await rest.get(Routes.currentApplication())) as RESTGetCurrentApplicationResult;

  await rest.put(Routes.applicationCommands(app.id), { body });
  console.log(`[deploy] ${app.name}: ${body.map((command) => `/${command.name}`).join(", ")} 등록`);

  if (legacyGuildId) {
    await rest
      .put(Routes.applicationGuildCommands(app.id, legacyGuildId), { body: [] })
      .then(() => console.log(`[deploy] ${app.name}: 서버 ${legacyGuildId} 의 예전 서버 전용 커맨드 삭제`))
      .catch((err) => console.warn(`[deploy] ${app.name}: 예전 서버 전용 커맨드를 지우지 못했습니다:`, err.message));
  }
}
