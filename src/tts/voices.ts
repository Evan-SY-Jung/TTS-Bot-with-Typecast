import { readFileSync } from "node:fs";

export interface Voice {
  /** DB에 저장되는 값. 한번 정하면 바꾸지 않는다. */
  key: string;
  /** 디스코드에 보이는 이름 */
  label: string;
  /** Typecast voice_id (tc_… 또는 uc_…) */
  voiceId: string;
}

export interface VoiceCatalog {
  readonly all: readonly Voice[];
  readonly fallback: Voice;
  get(key: string | null | undefined): Voice | undefined;
  /** 키나 이름으로 찾는다. 슬래시 커맨드에서 목록을 고르지 않고 직접 입력한 경우에 대비한다. */
  find(input: string): Voice | undefined;
  /** 저장된 키가 없거나 목록에서 빠졌으면 기본 목소리를 돌려준다. */
  resolve(...keys: (string | null | undefined)[]): Voice;
  search(query: string): Voice[];
}

type Env = Record<string, string | undefined>;

/** 목소리 키 → 환경변수 이름. voices.json에 voiceId가 없을 때 쓴다. */
export function voiceEnvKey(key: string): string {
  return `TYPECAST_VOICE_${key.toUpperCase().replaceAll("-", "_")}`;
}

export function createVoiceCatalog(entries: unknown, env: Env = {}, defaultKey?: string): VoiceCatalog {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error("목소리 목록이 비어 있습니다. 목소리를 하나 이상 넣어 주세요.");
  }

  const byKey = new Map<string, Voice>();
  for (const entry of entries as Record<string, unknown>[]) {
    const key = typeof entry?.key === "string" ? entry.key.trim() : "";
    if (!/^[a-z0-9_-]{1,32}$/.test(key)) {
      throw new Error(`목소리 key 는 영문 소문자·숫자·-·_ 1~32자여야 합니다. (받은 값: ${JSON.stringify(entry?.key)})`);
    }
    if (byKey.has(key)) throw new Error(`목소리 key 가 겹칩니다: ${key}`);

    const label = typeof entry.label === "string" && entry.label.trim() ? entry.label.trim() : key;
    const inline = typeof entry.voiceId === "string" ? entry.voiceId.trim() : "";
    const voiceId = inline || env[voiceEnvKey(key)]?.trim() || "";
    if (!voiceId) {
      throw new Error(
        `목소리 "${key}" 의 voice_id 가 없습니다. voices.json 에 voiceId 를 넣거나 환경변수 ${voiceEnvKey(key)} 를 설정해 주세요.`,
      );
    }
    byKey.set(key, { key, label, voiceId });
  }

  const all = [...byKey.values()];
  const fallback = defaultKey ? byKey.get(defaultKey) : all[0];
  if (!fallback) {
    throw new Error(
      `DEFAULT_TTS_VOICE 는 ${all.map((v) => v.key).join(", ")} 중 하나여야 합니다. (받은 값: ${defaultKey})`,
    );
  }

  const get: VoiceCatalog["get"] = (key) => (key ? byKey.get(key) : undefined);

  return {
    all,
    fallback,
    get,
    find(input) {
      const needle = input.trim().toLowerCase();
      return byKey.get(needle) ?? all.find((voice) => voice.label.toLowerCase() === needle);
    },
    resolve(...keys) {
      for (const key of keys) {
        const voice = get(key);
        if (voice) return voice;
      }
      return fallback;
    },
    search(query) {
      const needle = query.trim().toLowerCase();
      if (!needle) return all;
      return all.filter((voice) => voice.key.includes(needle) || voice.label.toLowerCase().includes(needle));
    },
  };
}

export function loadVoiceCatalog(path: string, env: Env = process.env, defaultKey?: string): VoiceCatalog {
  let entries: unknown;
  try {
    entries = JSON.parse(readFileSync(path, "utf8"));
  } catch (cause) {
    throw new Error(`목소리 목록 파일을 읽을 수 없습니다: ${path}`, { cause });
  }
  return createVoiceCatalog(entries, env, defaultKey);
}
