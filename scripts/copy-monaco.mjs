// Monaco 에디터 파일을 node_modules에서 public/monaco/vs로 복사한다 (설치·빌드 때 자동 실행).
// 외부 CDN(jsDelivr)이 막힌 학교·회사 네트워크에서도 에디터가 뜨게, 우리 도메인에서 직접 내려준다.
import { cpSync, existsSync, rmSync } from "node:fs";

const from = "node_modules/monaco-editor/min/vs";
const to = "public/monaco/vs";
if (!existsSync(from)) {
  console.warn("[monaco] monaco-editor가 설치되지 않아 복사를 건너뜁니다.");
} else {
  rmSync(to, { recursive: true, force: true }); // 버전이 바뀌었을 때 옛 파일이 섞이지 않게
  cpSync(from, to, { recursive: true });
  console.log("[monaco] public/monaco/vs 준비 완료");
}
