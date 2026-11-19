import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  // Expliciet "0": dan laat de bundler de democode (src/demo/) helemaal weg uit de echte app.
  env: { NEXT_PUBLIC_DEMO: "0" },
  // De content-bestanden worden tijdens runtime gelezen; neem ze mee in de standalone-build.
  outputFileTracingIncludes: { "/**": ["./content/**/*"] },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
