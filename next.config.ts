import type { NextConfig } from "next";
import path from "node:path";
import packageJson from "./package.json";

const nextConfig: NextConfig = {
  devIndicators: false,
  env: {
    NEXT_PUBLIC_APP_VERSION: packageJson.version,
  },
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
