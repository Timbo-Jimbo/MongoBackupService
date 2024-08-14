/** @type {import('next').NextConfig} */
const nextConfig = {
    experimental: {
        instrumentationHook: true
    },
    webpack: (config) => {
        config.module.rules.push({
            test: /\.md$/,
            use: 'raw-loader'
        });

        return config;
    }
};

export default nextConfig;
