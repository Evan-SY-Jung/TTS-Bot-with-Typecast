import { Client, Events, GatewayIntentBits } from "discord.js";
import { getConfig } from "./config";
import { connectMongo } from "./db/index";
import { registerCommands } from "./discord/registerCommands";
import { setupInteractionHandlers } from "./discord/handlers/interactions";
import { setupVoiceIdleDisconnect } from "./discord/handlers/voiceIdleDisconnect";
import { setupMessageCreateHandler } from "./discord/handlers/messageCreate";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

setupInteractionHandlers(client);
setupVoiceIdleDisconnect(client);
setupMessageCreateHandler(client);

client.once(Events.ClientReady, () => {
  console.log(`Logged in as ${client.user?.tag ?? "unknown"}`);
});

async function main() {
  const config = getConfig();
  await connectMongo();
  await registerCommands();
  await client.login(config.discordBotToken);
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});

