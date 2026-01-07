
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    // Satisfies the requirement for API keys in browser environments
    'process.env.API_KEY': JSON.stringify(process.env.VITE_API_KEY || process.env.API_KEY),
    'process.env.SUPABASE_KEY': JSON.stringify(process.env.VITE_SUPABASE_KEY || process.env.SUPABASE_KEY),
    'process.env.HF_TOKEN': JSON.stringify(process.env.VITE_HF_TOKEN || process.env.HF_TOKEN)
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: './index.html'
      }
    }
  }
});
