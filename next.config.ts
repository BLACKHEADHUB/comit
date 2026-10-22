import type { NextConfig } from "next";

// 기본 보안 헤더: 다른 사이트가 iframe으로 감싸거나(클릭재킹), 타입을 추측해 실행하거나, 주소(초대 토큰 포함)가 Referer로 새는 것을 막는다
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "same-origin" },
  // HTTPS로만 접속하게 (배포 도메인 기준, 1년). 로컬 http 개발에는 브라우저가 적용하지 않는다
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  // 쓰지 않는 브라우저 기능(카메라, 마이크, 위치)은 아예 끈다
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
