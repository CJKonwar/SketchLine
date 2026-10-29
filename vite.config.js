import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(({mode})=>({
 plugins:[react()],
 // Hosted builds use visitor keys at runtime; never load this Mac's .env files.
 envDir:mode==='public'?false:undefined,
 server:{host:'127.0.0.1'},
 build:{target:'es2022'},
}));
