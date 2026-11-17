# TTS Bot with Typecast

지정한 채널에 올라온 채팅을 [Typecast](https://typecast.ai/developers) 음성으로 읽어 주는 Discord 봇입니다.

- 여러 서버에서 쓸 수 있습니다. 읽을 채널과 기본 목소리는 서버마다 슬래시 커맨드로 정합니다.
- 봇 토큰을 여러 개 넣으면 한 서버에서 음성 채널 여러 곳을 동시에 쓸 수 있습니다.
- 유저마다 목소리를 고를 수 있습니다.

## 동작 방식

1. 관리자가 `/tts channel add` 로 TTS 채널을 등록합니다.
2. 음성 채널에 들어가 있는 사람이 TTS 채널에 글을 쓰면, 봇이 그 음성 채널에 들어와서 읽습니다.
3. 봇은 다 읽은 뒤에도 채널에 남아 있다가, 사람이 모두 나가면 같이 나갑니다.

읽는 중에 온 메시지는 읽지 않고 넘깁니다. 메시지 하나에서 읽는 글자 수는 `TTS_MAX_CHARS`(기본 200자)까지입니다.

### 봇이 여러 개일 때

메시지를 읽을 봇은 이렇게 고릅니다.

1. 글쓴이의 음성 채널에 이미 들어와 있는 봇
2. 없으면, 어느 음성 채널에도 없는 봇 (`DISCORD_BOT_TOKENS` 에 적은 순서대로)

다른 음성 채널에서 쓰이고 있는 봇은 끌어오지 않습니다. 남는 봇이 없으면 채널에 잠깐 안내가 뜹니다.
TTS 채널은 봇별로 나누지 않습니다. 등록한 채널이면 어느 채널에 써도 위 규칙대로 봇이 정해집니다.

## 준비

- Node.js 24 LTS (22.18 이상이면 동작) 또는 Docker
- Typecast API 키와 사용할 목소리의 `voice_id`
- Discord 봇 (동시에 쓸 음성 채널 수만큼)
  - 개발자 포털 → Bot → **Message Content Intent** 켜기
  - 초대할 때 scope: `bot`, `applications.commands`
  - 권한: 채널 보기, 메시지 보내기, 메시지 관리(본인 메시지 삭제 기능용), 연결, 말하기
  - 봇이 여러 개면 모두 같은 권한을 줍니다.

## 실행

```bash
cp .env.example .env    # 값 채우기
```

### Docker

```bash
docker compose run --rm bot npm run deploy-commands   # 슬래시 커맨드 등록 (처음 한 번)
docker compose up -d --build
docker compose logs -f
```

설정은 `data` 볼륨의 SQLite 파일에 저장됩니다.

### 직접 실행

```bash
npm ci
npm run deploy-commands   # 슬래시 커맨드 등록 (처음 한 번)
npm start
```

TypeScript 파일을 Node가 바로 실행하므로 빌드 단계가 없습니다.

슬래시 커맨드는 전역으로 등록됩니다. 커맨드 이름이나 옵션을 바꿨을 때만 `deploy-commands` 를 다시 실행하면 됩니다.

## 커맨드

| 커맨드                          | 누가           | 설명                                              |
| ------------------------------- | -------------- | ------------------------------------------------- |
| `/voice speaker:`               | 누구나         | 내 TTS 목소리 선택                                |
| `/tts-delete mode:on\|off`      | 누구나         | 봇이 읽은 내 메시지를 지울지                      |
| `/tts channel add [channel]`    | 서버 관리 권한 | TTS 채널 등록 (비우면 지금 채널)                  |
| `/tts channel remove [channel]` | 서버 관리 권한 | TTS 채널 해제                                     |
| `/tts channel list`             | 서버 관리 권한 | 등록된 TTS 채널 보기                              |
| `/tts default-voice speaker:`   | 서버 관리 권한 | 목소리를 고르지 않은 사람에게 쓸 서버 기본 목소리 |

봇을 여러 개 쓰면 같은 커맨드가 봇마다 하나씩 보입니다. 설정을 공유하므로 어느 쪽을 써도 결과는 같습니다.

## 환경변수

| 이름                    | 필수 | 기본값           | 설명                                                 |
| ----------------------- | ---- | ---------------- | ---------------------------------------------------- |
| `DISCORD_BOT_TOKENS`    | ✅   |                  | 봇 토큰. 쉼표로 여러 개                              |
| `TYPECAST_API_KEY`      | ✅   |                  | 모든 서버가 이 키 하나를 같이 씁니다                 |
| `TYPECAST_VOICE_<KEY>`  |      |                  | `voices.json` 에 `voiceId` 가 없는 목소리의 voice_id |
| `ALLOWED_GUILD_IDS`     |      | (모든 서버)      | 이 서버들에서만 동작                                 |
| `TYPECAST_MODEL`        |      | `auto`           | `auto` \| `ssfm-v21` \| `ssfm-v30` \| `ssfm-v31`     |
| `TYPECAST_LANGUAGE`     |      | (자동 감지)      | ISO 639-3 코드 (예: `kor`)                           |
| `TYPECAST_AUDIO_FORMAT` |      | `mp3`            | `mp3` \| `wav`                                       |
| `DEFAULT_TTS_VOICE`     |      | 목록의 첫 번째   | 기본 목소리 키                                       |
| `TTS_MAX_CHARS`         |      | `200`            | 메시지 하나에서 읽는 최대 글자 수                    |
| `DATABASE_PATH`         |      | `data/ttsbot.db` | SQLite 파일 위치                                     |

## 목소리 추가·변경

`config/voices.json` 에 한 줄을 추가하고 봇을 재시작합니다. 커맨드를 다시 등록할 필요는 없습니다.

```json
{ "key": "newvoice", "label": "새 목소리", "voiceId": "tc_xxxxxxxx" }
```

- `key`: 저장용 이름(영문 소문자·숫자·`-`·`_`). 유저 설정에 저장되므로 나중에 바꾸지 않습니다.
- `label`: 디스코드에 보이는 이름
- `voiceId`: 생략하면 환경변수 `TYPECAST_VOICE_<KEY 대문자>` 에서 읽습니다.

목록에서 뺀 목소리를 쓰던 사람은 서버 기본 목소리로 돌아갑니다.

## v1 에서 옮기기

1. `.env` 정리
   - `DISCORD_BOT_TOKEN` 과 `.env.bot2` 의 토큰을 `DISCORD_BOT_TOKENS=토큰A,토큰B` 한 줄로 합칩니다.
   - `TYPECAST_*`, `DEFAULT_TTS_VOICE` 는 그대로 둡니다.
   - `MONGODB_URI`, `DISCORD_CLIENT_ID`, `TTS_TEXT_CHANNEL_IDS` 는 더 이상 쓰지 않으니 지웁니다. `.env.bot2` 도 필요 없습니다.
   - `DISCORD_GUILD_ID` 는 다음 단계까지만 남겨 둡니다.
2. `npm run deploy-commands` 를 실행합니다. 전역 커맨드를 등록하고, `DISCORD_GUILD_ID` 가 남아 있으면 그 서버에만 등록돼 있던 예전 커맨드를 지웁니다. 끝나면 `DISCORD_GUILD_ID` 를 지웁니다.
3. 예전 프로세스를 내립니다 (`pm2 delete ttsbot-a ttsbot-b`). 이제 프로세스 하나가 봇을 모두 돌립니다.
4. 봇을 실행하고, 각 서버에서 TTS로 쓰던 채널마다 `/tts channel add` 를 한 번씩 실행합니다.
5. MongoDB 에 있던 유저별 설정(목소리, 메시지 삭제)은 옮겨지지 않습니다. 각자 `/voice`, `/tts-delete` 로 다시 설정합니다.

## 폴더 구조

```
config/voices.json       목소리 목록
src/
  index.ts               시작점: 설정 → DB → 봇 로그인, 종료 처리
  config.ts              환경변수 읽기·검증
  context.ts             핸들러들이 공유하는 객체 타입
  deploy-commands.ts     슬래시 커맨드 등록 스크립트
  commands/              커맨드 하나 = 파일 하나 (index.ts 에 목록)
  events/                이벤트 하나 = 파일 하나 (index.ts 에서 등록)
  tts/
    typecast.ts          Typecast 합성 (재시도, 모델 폴백)
    player.ts            음성 연결과 재생
    pickBot.ts           읽을 봇 고르기
    text.ts              메시지 텍스트 정리
    voices.ts            목소리 목록
    errors.ts            오류 → 안내 문구
  db/                    SQLite(node:sqlite), 마이그레이션, 서버·유저 설정
```

## 개발

```bash
npm run dev         # 파일이 바뀌면 자동 재시작
npm test            # node:test
npm run typecheck   # tsc --noEmit
npm run lint        # Biome (고치려면 npm run format)
```

커맨드를 추가할 때는 `src/commands/` 에 파일을 만들고 `src/commands/index.ts` 목록에 넣은 뒤 `npm run deploy-commands` 를 실행합니다.
