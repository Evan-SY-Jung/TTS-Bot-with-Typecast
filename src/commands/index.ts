import { tts } from "./tts.ts";
import { ttsDelete } from "./tts-delete.ts";
import type { Command } from "./types.ts";
import { voice } from "./voice.ts";

/** 커맨드를 추가할 때는 파일을 만들고 여기에 넣은 뒤 `npm run deploy-commands` 를 실행한다. */
export const commands: ReadonlyMap<string, Command> = new Map(
  [voice, ttsDelete, tts].map((command) => [command.data.name, command]),
);
