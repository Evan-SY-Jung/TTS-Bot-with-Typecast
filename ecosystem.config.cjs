/**
 * 한 폴더에서 봇 A / B 동시 구동 (PM2).
 *
 *   npm run build
 *   pm2 start ecosystem.config.cjs
 *
 * `.env.bot2` 는 `.env.bot2.example` 을 참고해 프로젝트 루트에 만듭니다.
 * Node 20+ 필요 (--env-file).
 */
module.exports = {
  apps: [
    {
      name: "ttsbot-a",
      script: "dist/index.js",
      cwd: __dirname,
      node_args: "--env-file=.env",
    },
    {
      name: "ttsbot-b",
      script: "dist/index.js",
      cwd: __dirname,
      node_args: "--env-file=.env.bot2",
    },
  ],
};
