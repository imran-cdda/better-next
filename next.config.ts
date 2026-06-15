import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "http://localhost:3000",
    "https://localhost",
    "http://127.0.0.1:3000",
    "http://mdimranh.com:3000",
    "mdimranh.com",
  ],
}

export default nextConfig
