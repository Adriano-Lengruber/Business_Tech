import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@al/shared', '@al/design-system'],
};

export default nextConfig;
