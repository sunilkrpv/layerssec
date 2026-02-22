/** @type {import('next').NextConfig} */
const nextConfig = {
  // Prevent Next.js from bundling the Anthropic SDK into the client bundle
  serverExternalPackages: ['@anthropic-ai/sdk'],
};

export default nextConfig;
