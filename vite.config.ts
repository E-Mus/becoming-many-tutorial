import { defineConfig } from 'vite';

function githubPagesBase() {
  if (!process.env.GITHUB_ACTIONS) return './';

  const repo = process.env.GITHUB_REPOSITORY?.split('/')[1] ?? 'weiss1';
  return repo.endsWith('.github.io') ? '/' : `/${repo}/`;
}

export default defineConfig({
  base: githubPagesBase(),
  server: { host: true }, // host: true -> auch per LAN / Quest erreichbar
  build: { target: 'esnext' },
});
