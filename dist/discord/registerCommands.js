"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerCommands = registerCommands;
const discord_js_1 = require("discord.js");
const UserSetting_1 = require("../db/models/UserSetting");
const config_1 = require("../config");
async function registerCommands() {
    const config = (0, config_1.getConfig)();
    const { discordBotToken, discordClientId, discordGuildId } = config;
    if (!discordClientId) {
        console.warn("DISCORD_CLIENT_ID 가 비어있어서 슬래시 커맨드 등록을 스킵합니다. " +
            "환경변수에 DISCORD_CLIENT_ID를 넣고 다시 실행하세요.");
        return;
    }
    const voiceChoices = UserSetting_1.TTS_VOICE_KEYS.map((key) => ({
        name: UserSetting_1.TTS_VOICE_LABEL[key],
        value: key,
    }));
    const commands = [
        new discord_js_1.SlashCommandBuilder()
            .setName("voice")
            .setDescription("TTS 읽기 목소리 선택")
            .addStringOption((opt) => opt
            .setName("speaker")
            .setDescription("목소리")
            .setRequired(true)
            .addChoices(...voiceChoices))
            .toJSON(),
        new discord_js_1.SlashCommandBuilder()
            .setName("tts-delete")
            .setDescription("본인 TTS 트리거 메시지 삭제 on/off (본인에게만 적용)")
            .addStringOption((opt) => opt
            .setName("mode")
            .setDescription("삭제 on/off")
            .setRequired(true)
            .addChoices({ name: "on", value: "on" }, { name: "off", value: "off" }))
            .toJSON(),
    ];
    const rest = new discord_js_1.REST({ version: "10" }).setToken(discordBotToken);
    const route = discordGuildId
        ? discord_js_1.Routes.applicationGuildCommands(discordClientId, discordGuildId)
        : discord_js_1.Routes.applicationCommands(discordClientId);
    await rest.put(route, { body: commands });
    console.log(`Slash commands registered (${discordGuildId ? "guild" : "global"}): ${commands
        .map((c) => c.name)
        .join(", ")}`);
}
