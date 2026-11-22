import tailwindcss from '@tailwindcss/vite';
import fs from 'fs';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    base: './',
    plugins: [
      tailwindcss(),
      {
        name: 'copy-unbundled-src-assets',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }
          const distDir = path.resolve(import.meta.dirname, 'dist');
          const srcAssets = path.resolve(import.meta.dirname, 'src/assets');
          const distAssets = path.resolve(distDir, 'src/assets');
          if (fs.existsSync(distDir) && fs.existsSync(srcAssets)) {
            fs.cpSync(srcAssets, distAssets, { recursive: true, force: true });
          }
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, './src'),
      },
    },
    build: {
      target: 'es2022',
      sourcemap: false,
      cssCodeSplit: true,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('/src/features/adminPanel')) return 'chunk-admin';
            if (id.includes('/src/features/cbtArena')) return 'chunk-cbt';
            if (id.includes('/src/features/mediaAndDictation')) return 'chunk-media-dictation';
            if (id.includes('/src/features/typingAndEvaluation')) return 'chunk-typing-eval';
            if (id.includes('/src/features/videoAndTutor')) return 'chunk-video-tutor';
            if (id.includes('/src/features/feesAndBilling')) return 'chunk-fees';
            if (
              id.includes('/src/features/weakVaultAndPlanner') ||
              id.includes('/src/features/communityAndAnalytics')
            ) {
              return 'chunk-engagement';
            }
            if (id.includes('/src/templates/')) return 'chunk-templates';
            if (id.includes('/src/core/') || id.includes('/src/utils/')) return 'chunk-core';
            return undefined;
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
