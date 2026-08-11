/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["@napi-rs/canvas", "unpdf"],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "ui-avatars.com",
        pathname: "/api/**",
      },
    ],
  },
  async redirects() {
    return [
      {
        source: "/dashboard/bicicopilot",
        destination: "/dashboard/smartbike",
        permanent: true,
      },
      {
        source: "/puerto-libre",
        destination: "/importacion",
        permanent: false,
      },
      {
        source: "/puerto-libre/:path*",
        destination: "/importacion/:path*",
        permanent: false,
      },
    ];
  },
};

module.exports = nextConfig;
