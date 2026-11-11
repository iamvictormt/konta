import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  async redirects() {
    return [
      { source: "/vendas", destination: "/loja/vendas", permanent: true },
      { source: "/produtos", destination: "/loja/produtos", permanent: true },
      { source: "/relatorios", destination: "/loja/relatorios", permanent: true },
      { source: "/caixa", destination: "/loja/caixa", permanent: true },
      { source: "/definicoes", destination: "/loja/definicoes", permanent: true },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
