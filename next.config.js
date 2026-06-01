/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.tiendanube.com" },
      { protocol: "https", hostname: "**.mitiendanube.com" },
      { protocol: "https", hostname: "d26lpennugtm8s.cloudfront.net" },
    ],
  },
};

module.exports = nextConfig;
