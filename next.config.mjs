/** @type {import('next').NextConfig} */
const devDistDir = process.env.NEXT_DEV_DIST_DIR?.trim() || ".next";

const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Отдельный кэш для dev:subs (.next-subs) и dev:gpt (.next-gpt) — иначе два npm run dev ломают маршруты (404).
  distDir: devDistDir,
  experimental: {
    // Меньше «бочковых» импортов lucide — стабильнее граф модулей в dev (Windows).
    optimizePackageImports: ["lucide-react"],
    outputFileTracingIncludes: {
      "/reviews": ["./data/gpt-telegram-reviews.json", "./public/gpt-telegram-reviews.json"],
      "/": ["./data/gpt-telegram-reviews.json", "./public/gpt-telegram-reviews.json"],
    },
  },
  // Не ограничиваем dev-origin'ы вручную: в этом проекте это приводило к 404
  // по /_next/static/* после автосмены порта dev-сервера.
  webpack(config, { dev }) {
    // Не ограничиваем dev-origin'ы вручную: в этом проекте это приводило к 404
    // по /_next/static/* после автосмены порта dev-сервера.
    if (dev) {
      // Windows + dev: частичное отключение splitChunks только на server давало
      // гонки и MODULE_NOT_FOUND "./undefined" в .next/server/webpack-runtime.js
      // при редиректах (например /auth/callback → /login).
      config.cache = false;
      config.parallelism = 1;
      config.optimization = {
        ...config.optimization,
        splitChunks: false,
        runtimeChunk: false,
        // Стабильные id модулей/чанков — иначе на Windows иногда __webpack_require__(undefined)
        moduleIds: "named",
        chunkIds: "named",
        removeAvailableModules: false,
        removeEmptyChunks: false,
        mergeDuplicateChunks: true,
      };
    }
    return config;
  },
  async redirects() {
    return [
      {
        source: "/dashboard/order/:orderId",
        has: [{ type: "query", key: "site", value: "subs-store" }],
        destination: "/dashboard/orders?site=subs-store&order_id=:orderId",
        permanent: false,
      },
      {
        source: "/dashboard/order/:orderId",
        destination: "/dashboard/orders?site=gpt-store&order_id=:orderId",
        permanent: false,
      },
      { source: "/order", destination: "/checkout", permanent: true },
      { source: "/chatgpt", destination: "/gpt", permanent: false },
      { source: "/gpt-store", destination: "/gpt", permanent: false },
      { source: "/pricing", destination: "/", permanent: false },
      { source: "/subs", destination: "/spotify", permanent: false },
      { source: "/subs-store", destination: "/spotify", permanent: false },
      { source: "/spotify-store", destination: "/spotify", permanent: false },
    ];
  },
};

export default nextConfig;
