/** @type {import('next').NextConfig} */
const nextConfig = {
  // proxy /api/* to the Express backend during development
  async rewrites() {
    const api = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
    return [{ source: "/api/:path*", destination: `${api}/api/:path*` }];
  },
};

export default nextConfig;
