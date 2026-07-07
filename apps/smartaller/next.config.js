/** @type {import('next').NextConfig} */
const nextConfig = {
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
    ];
  },
};

module.exports = nextConfig;
