import type {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
} from "discord.js";
import type { AppContext } from "../context.ts";

export interface Command {
  data: { name: string; toJSON(): RESTPostAPIChatInputApplicationCommandsJSONBody };
  execute(interaction: ChatInputCommandInteraction<"cached">, ctx: AppContext): Promise<unknown>;
  autocomplete?(interaction: AutocompleteInteraction<"cached">, ctx: AppContext): Promise<unknown>;
}

/** 목소리 옵션 자동완성. voices.json 을 바꿔도 커맨드를 다시 등록할 필요가 없다. */
export function suggestVoices(interaction: AutocompleteInteraction, ctx: AppContext): Promise<void> {
  const matches = ctx.voices.search(interaction.options.getFocused());
  // 디스코드가 한 번에 받는 선택지는 25개까지다.
  return interaction.respond(matches.slice(0, 25).map((voice) => ({ name: voice.label, value: voice.key })));
}
