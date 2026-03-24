import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import fs from "node:fs";

// https://vite.dev/config/
export default defineConfig({
    plugins: [vue(), tailwindcss()],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
    server: {
        // --- 解决局域网访问 (手机测试) ---
        // 设置为 '0.0.0.0' 或 true，允许局域网 IP 访问
        host: "0.0.0.0",

        // 端口
        port: 5173,

        // HTTPS 配置
        https: {
            key: fs.readFileSync("localhost+1-key.pem"),//本地测试用证书
            cert: fs.readFileSync("localhost+1.pem"),
        },
        proxy: {
            "/api": {
                target: "https://localhost:8080",
                changeOrigin: true,
                secure: false,
                rewrite: (path) => path.replace(/^\/api/, "/api/v1"),
            },
        },
    },
});
 