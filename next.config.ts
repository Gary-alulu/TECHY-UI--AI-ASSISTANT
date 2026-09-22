import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compress: true,
  // Every route in this app serves live OS-local data with `no-store`, so there is
  // nothing to gain from Next's in-memory cache — cap it at zero to avoid keeping
  // stale bulk copies around (dev keeps its own cache regardless).
  cacheMaxMemorySize: 0,
  experimental: {
    // Skip writing Turbopack's filesystem caches (.next/dev/cache, .next/cache).
    turbopackFileSystemCacheForDev: false,
    turbopackFileSystemCacheForBuild: false,
  },
};

export default nextConfig;
