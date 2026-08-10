import type { NextConfig } from "next";

// Auth off by default for client demos. Set DISABLE_AUTH=false on Vercel to require login.
const authDisabled = process.env.DISABLE_AUTH !== "false";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["*.ngrok-free.app", "*.ngrok.io", "*.ngrok.app"],
  serverExternalPackages: ["pdf-parse"],
  env: {
    DISABLE_AUTH: authDisabled ? "true" : "false",
    NEXT_PUBLIC_DISABLE_AUTH:
      process.env.NEXT_PUBLIC_DISABLE_AUTH !== "false" ? "true" : "false",
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
