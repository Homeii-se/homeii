import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Tillåt större request-bodies för server actions. PDF:er som base64 
      // kan nå 5-10 MB. Default är 1 MB.
      bodySizeLimit: "20mb",
    },
  },
};

export default nextConfig;