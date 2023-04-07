import visualizer from 'rollup-plugin-visualizer';
import { defineConfig, PluginOption } from 'vite';
import solidPlugin from 'vite-plugin-solid';

export default defineConfig({
  plugins: [
    solidPlugin(),
    visualizer({
      template: "treemap",
      gzipSize: true,
      brotliSize: true,
      filename: "analyze.html",
    }) as PluginOption,
  ],
  build: {
    target: 'esnext',
  }
});
