import type { NextConfig } from 'next';
import path from 'path';
import { config } from 'dotenv';

// Load .env from monorepo root (cwd is apps/web when run via pnpm dev)
config({ path: path.resolve(process.cwd(), '../../.env') });
config({ path: path.resolve(process.cwd(), '../../.env.local') });

const nextConfig: NextConfig = {
  transpilePackages: ['@ekos/core'],
};

export default nextConfig;
