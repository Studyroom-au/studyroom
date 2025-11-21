import type { NextConfig } from 'next';

const nextConfig = {
  allowedDevOrigins: [
    'http://localhost:3002',
    'http://192.168.50.137:3002',
  ],
} satisfies NextConfig;

export default nextConfig;
