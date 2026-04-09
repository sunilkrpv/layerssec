/** @type {import('next').NextConfig} */
const nextConfig = {
  // Prevent Next.js from bundling the Anthropic SDK into the client bundle
  serverExternalPackages: ['@anthropic-ai/sdk'],
  // Enable standalone output for Docker deployments
  output: 'standalone',
};

export default nextConfig;
