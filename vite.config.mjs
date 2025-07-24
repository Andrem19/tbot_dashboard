// vite.config.mjs
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  return {
    // когда вы делаете `npm run build`, command === 'build'
    // и тогда базовый путь (base) будет указывать на ваш репо,
    // а в режиме dev — на корень '/'
    base: command === 'build' ? '/tbot_dashboard/' : '/',
    plugins: [ react() ],
    // остальные ваши опции, если нужны
  };
});
