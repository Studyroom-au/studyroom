import 'next';

declare module 'next' {
  interface NextConfig {
    allowedDevOrigins?: string[];
  }
}
