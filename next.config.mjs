import { withSentryConfig } from '@sentry/nextjs';

/** @type {import("next").NextConfig} */
const nextConfig = {
  typedRoutes: true,
  turbopack: {
    resolveAlias: {
      "ioredis/built/utils": "ioredis/built/utils/index.js",
    },
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.resolve.alias["ioredis/built/utils"] =
        "ioredis/built/utils/index.js";
    }

    return config;
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  silent: true,
  webpack: {
    treeshake: {
      removeDebugLogging: true
    }
  }
});
