import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' para funcionar dentro do .exe (Electron) e do .apk (Capacitor)
export default defineConfig({
  plugins: [react()],
  base: './',
});
