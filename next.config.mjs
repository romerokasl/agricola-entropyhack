/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ["msedge-tts", "ws", "bufferutil", "utf-8-validate"],
  },
};

export default nextConfig;



