import { type Client, Events, type Interaction, MessageFlags } from "discord.js";
import { commands } from "../commands/index.ts";
import { isGuildAllowed } from "../config.ts";
import type { AppContext } from "../context.ts";

async function handleInteraction(interaction: Interaction, ctx: AppContext): Promise<void> {
  if (!interaction.isChatInputCommand() && !interaction.isAutocomplete()) return;

  const command = commands.get(interaction.commandName);
  const usable = interaction.inCachedGuild() && isGuildAllowed(ctx.config, interaction.guildId);

  if (interaction.isAutocomplete()) {
    if (usable && command?.autocomplete) await command.autocomplete(interaction, ctx);
    else await interaction.respond([]);
    return;
  }

  if (!usable || !command) {
    await interaction.reply({
      content: command ? "이 서버에서는 사용할 수 없어요." : "알 수 없는 커맨드예요.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  try {
    await command.execute(interaction, ctx);
  } catch (err) {
    console.error(`[command] /${interaction.commandName} 오류:`, err);
    const content = "커맨드를 처리하다가 오류가 났어요. 잠시 뒤 다시 시도해 주세요.";
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ content, flags: MessageFlags.Ephemeral }).catch(() => {});
    } else {
      await interaction.reply({ content, flags: MessageFlags.Ephemeral }).catch(() => {});
    }
  }
}

export function registerInteractionCreate(client: Client, ctx: AppContext): void {
  client.on(Events.InteractionCreate, (interaction) => {
    handleInteraction(interaction, ctx).catch((err) => console.error("[command] 처리 오류:", err));
  });
}
