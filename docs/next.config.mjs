/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production';

const nextConfig = {
  output: 'export',
  images: { unoptimized: true },
  basePath: isProd ? '/gemreview' : '',
  assetPrefix: isProd ? '/gemreview/' : '',
};

export default nextConfig;
