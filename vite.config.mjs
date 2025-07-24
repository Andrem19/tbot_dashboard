// vite.config.mjs
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// если у вас ещё есть другие плагины — импортируйте их аналогично

export default defineConfig({
  base: command === 'build' ? '/tbot_dashboard/' : '/',    // если вы всё же хостите на USERNAME.github.io/REPO
  plugins: [react()],
  // при необходимости ваши дополнительные опции:
  // build: { outDir: 'dist', ... },
  // server: { port: 3000, ... },
});

