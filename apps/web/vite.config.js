import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { motionCss } from './src/lib/motion/tokens.js';

export default defineConfig({
  plugins: [react()],
  css: { postcss: { plugins: [{
    postcssPlugin: 'motion-tokens',
    AtRule: { 'motion-tokens': rule => rule.replaceWith(motionCss) }
  }] } }
});
