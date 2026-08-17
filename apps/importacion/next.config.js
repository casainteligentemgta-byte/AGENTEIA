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
