"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const config_1 = require("./config");
const index_1 = require("./db/index");
const registerCommands_1 = require("./discord/registerCommands");
const interactions_1 = require("./discord/handlers/interactions");
const voiceIdleDisconnect_1 = require("./discord/handlers/voiceIdleDisconnect");
const messageCreate_1 = require("./discord/handlers/messageCreate");
const client = new discord_js_1.Client({
    intents: [
        discord_js_1.GatewayIntentBits.Guilds,
        discord_js_1.GatewayIntentBits.GuildMessages,
        discord_js_1.GatewayIntentBits.MessageContent,
        discord_js_1.GatewayIntentBits.GuildVoiceStates,
    ],
});
(0, interactions_1.setupInteractionHandlers)(client);
(0, voiceIdleDisconnect_1.setupVoiceIdleDisconnect)(client);
(0, messageCreate_1.setupMessageCreateHandler)(client);
client.once(discord_js_1.Events.ClientReady, () => {
    console.log(`Logged in as ${client.user?.tag ?? "unknown"}`);
});
async function main() {
    const config = (0, config_1.getConfig)();
    await (0, index_1.connectMongo)();
    await (0, registerCommands_1.registerCommands)();
    await client.login(config.discordBotToken);
}
main().catch((err) => {
    console.error("Fatal startup error:", err);
    process.exit(1);
});
