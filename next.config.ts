import type { NextConfig } from "next";

// 기본 보안 헤더: 다른 사이트가 iframe으로 감싸거나(클릭재킹), 타입을 추측해 실행하거나, 주소(초대 토큰 포함)가 Referer로 새는 것을 막는다
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
