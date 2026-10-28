import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const page = (p) => resolve(import.meta.dirname, p);

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        landing: page('index.html'),
        dashboard: page('app/index.html'),
        log: page('app/log.html'),
        leaderboard: page('app/leaderboard.html'),
        challenges: page('app/challenges.html'),
        challenge: page('app/challenge.html'),
        athlete: page('app/athlete.html'),
      },
    },
  },
});
