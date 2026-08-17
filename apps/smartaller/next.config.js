/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["@napi-rs/canvas", "unpdf", "tesseract.js"],
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
        source: "/importacion",
        destination: "/smartimport",
        permanent: false,
      },
      {
        source: "/importacion/:path*",
        destination: "/smartimport/:path*",
        permanent: false,
      },
      {
        source: "/puerto-libre",
        destination: "/smartimport",
        permanent: false,
      },
      {
        source: "/puerto-libre/:path*",
        destination: "/smartimport/:path*",
        permanent: false,
      },
    ];
  },
};

module.exports = nextConfig;
