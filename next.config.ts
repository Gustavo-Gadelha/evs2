import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  // O rastreamento do build standalone não enxerga o binding nativo, carregado em runtime pelo better-sqlite3.
  outputFileTracingIncludes: {
    "/*": ["./node_modules/better-sqlite3/prebuilds/linuxmusl-*.node"],
  },
};

export default nextConfig;
