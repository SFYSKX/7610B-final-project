import {defineConfig} from 'vite';
export default defineConfig({build:{rollupOptions:{output:{manualChunks:{react:['react','react-dom/client'],ethers:['ethers']}}}}});
