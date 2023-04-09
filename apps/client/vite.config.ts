import visualizer from 'rollup-plugin-visualizer';
import { defineConfig, PluginOption } from 'vite';
import solidPlugin from 'vite-plugin-solid';
import devtools from 'solid-devtools/vite';

export default defineConfig({
  plugins: [
    devtools({
      autoname: true,
    }),
    solidPlugin(),
    visualizer({
      template: 'treemap',
      gzipSize: true,
      brotliSize: true,
      filename: 'analyze.html',
    }) as PluginOption,
  ],
  build: {
    target: 'esnext',
  },
});
