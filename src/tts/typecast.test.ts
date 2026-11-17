import assert from "node:assert/strict";
import { text as readAll } from "node:stream/consumers";
import { test } from "node:test";
import { type TTSRequestStream, TypecastAPIError } from "@neosapience/typecast-js";
import { createSynthesizer, modelOrder } from "./typecast.ts";

const config = {
  typecastApiKey: "test",
  typecastModel: "auto",
  typecastLanguage: undefined,
  audioFormat: "mp3",
} as const;

const audio = (content: string) => new Response(content).body as ReadableStream<Uint8Array>;

/** 호출마다 준비된 응답(오류 또는 오디오)을 차례로 돌려주는 가짜 Typecast 클라이언트 */
function fakeClient(...responses: (Error | string)[]) {
  const requests: TTSRequestStream[] = [];
  return {
    requests,
    async textToSpeechStream(request: TTSRequestStream) {
      requests.push(request);
      const next = responses.shift();
      if (next === undefined) throw new Error("예상보다 많이 호출됨");
      if (next instanceof Error) throw next;
      return audio(next);
    },
  };
}

test("모델 순서", () => {
  assert.deepEqual(modelOrder("auto"), ["ssfm-v30", "ssfm-v21"]);
  assert.deepEqual(modelOrder("ssfm-v30"), ["ssfm-v30", "ssfm-v21"]);
  assert.deepEqual(modelOrder("ssfm-v21"), ["ssfm-v21", "ssfm-v30"]);
  assert.deepEqual(modelOrder("ssfm-v31"), ["ssfm-v31", "ssfm-v30"]);
});

test("합성 결과를 스트림으로 돌려준다", async () => {
  const client = fakeClient("AUDIO");
  const stream = await createSynthesizer(config, client)("안녕", "tc_a");

  assert.equal(await readAll(stream), "AUDIO");
  assert.deepEqual(client.requests, [
    { text: "안녕", voice_id: "tc_a", model: "ssfm-v30", output: { audio_format: "mp3" } },
  ]);
});

test("언어를 지정하면 요청에 넣는다", async () => {
  const client = fakeClient("AUDIO");
  await createSynthesizer({ ...config, typecastLanguage: "kor" }, client)("안녕", "tc_a");
  assert.equal(client.requests[0]?.language, "kor");
});

test("5xx 는 같은 모델로 다시 시도한다", async () => {
  const client = fakeClient(new TypecastAPIError("server", 503), "AUDIO");
  const stream = await createSynthesizer(config, client, 0)("안녕", "tc_a");

  assert.equal(await readAll(stream), "AUDIO");
  assert.deepEqual(
    client.requests.map((r) => r.model),
    ["ssfm-v30", "ssfm-v30"],
  );
});

test("모델·목소리 문제면 다음 모델로 넘어간다", async () => {
  const client = fakeClient(new TypecastAPIError("unprocessable", 422), "AUDIO");
  const stream = await createSynthesizer(config, client, 0)("안녕", "tc_a");

  assert.equal(await readAll(stream), "AUDIO");
  assert.deepEqual(
    client.requests.map((r) => r.model),
    ["ssfm-v30", "ssfm-v21"],
  );
});

test("크레딧 부족(402) 같은 오류는 다른 모델을 시도하지 않고 바로 던진다", async () => {
  const client = fakeClient(new TypecastAPIError("payment required", 402));
  await assert.rejects(createSynthesizer(config, client, 0)("안녕", "tc_a"), { statusCode: 402 });
  assert.equal(client.requests.length, 1);
});

test("5xx 가 계속되면 3번 시도한 뒤 던진다", async () => {
  const error = () => new TypecastAPIError("server", 500);
  const client = fakeClient(error(), error(), error());
  await assert.rejects(createSynthesizer(config, client, 0)("안녕", "tc_a"), { statusCode: 500 });
  assert.equal(client.requests.length, 3);
});
