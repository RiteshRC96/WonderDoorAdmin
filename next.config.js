
/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'drive.google.com',
        port: '',
        pathname: '/**', // Adjust pathname if needed for more specific patterns
      },
      // Add Firebase Storage hostname if you are using it for images
      // Example: Replace 'your-project-id.appspot.com' with your actual storage bucket hostname
      {
         protocol: 'https',
         hostname: '*.appspot.com', // Allows subdomains like 'storage.googleapis.com' used by Firebase Storage
         port: '',
         pathname: '/v0/b/**', // Path for Firebase Storage URLs
      },
       {
         protocol: 'https',
         hostname: 'storage.googleapis.com', // Explicitly add this if needed
         port: '',
         pathname: '/**',
       },
       {
         protocol: 'https',
         hostname: 'plus.unsplash.com', // Add Unsplash hostname
         port: '',
         pathname: '/**',
       },
       {
         protocol: 'https',
         hostname: 'images.unsplash.com', // Add Unsplash hostname
         port: '',
         pathname: '/**',
       },
       {
         protocol: 'https',
         hostname: 'www.doors.com', // Add doors.com hostname
         port: '',
         pathname: '/**',
       },
       {
         protocol: 'https',
         hostname: 'tiimg.tistatic.com', // Add tiimg.tistatic.com hostname
         port: '',
         pathname: '/**',
       }
    ],
  },
};

module.exports = nextConfig; // Use module.exports for commonjs
