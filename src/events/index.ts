import type { Client } from "discord.js";
import type { AppContext } from "../context.ts";
import { registerGuildDelete } from "./guildDelete.ts";
import { registerInteractionCreate } from "./interactionCreate.ts";
import { registerMessageCreate } from "./messageCreate.ts";
import { registerVoiceStateUpdate } from "./voiceStateUpdate.ts";

export function registerEvents(client: Client, ctx: AppContext): void {
  registerInteractionCreate(client, ctx);
  registerMessageCreate(client, ctx);
  registerVoiceStateUpdate(client);
  registerGuildDelete(client, ctx);
}
