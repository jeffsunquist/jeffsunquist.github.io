import { defineConfig } from 'vite'

// The repo normally lives on a Windows drive mounted into WSL (/mnt/d, 9p/drvfs),
// where inotify doesn't fire — so Vite never sees saved files and the dev server
// (both `npx slidev` and the VS Code Slidev preview) never hot-reloads. Polling
// makes it notice saves; 500 ms keeps the CPU cost low. Dev-only: ignored by
// `slidev build` / `slidev export`.
export default defineConfig({
  server: {
    watch: {
      usePolling: true,
      interval: 500,
    },
  },
})
