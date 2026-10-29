import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // O dev server sobe em 0.0.0.0 dentro do container; libera o HMR também quando aberto por 127.0.0.1.
  allowedDevOrigins: ["127.0.0.1"],
  poweredByHeader: false,
};

export default nextConfig;
