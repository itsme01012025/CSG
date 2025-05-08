/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow embedding in iframes
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'ALLOWALL',
          },
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
        ],
      },
    ];
  },
  // Configure image domains
  images: {
    domains: [
      'cybersafegirl.com', 
      'www.cybersafegirl.com',
      'cybersafegirl.vercel.app',
      'images.unsplash.com',
      'avatars.githubusercontent.com',
      'github.com',
      'lh3.googleusercontent.com'
    ],
  }
}

module.exports = nextConfig