import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow opening the dev app via ngrok (otherwise assets/auth redirect to localhost)
  allowedDevOrigins: ["*.ngrok-free.app", "*.ngrok.io", "*.ngrok.app"],
  env: {
    // next-auth/react client reads NEXTAUTH_URL at build time
    NEXTAUTH_URL: process.env.AUTH_URL,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
