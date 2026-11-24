"use client";

import { useState } from "react";
import CodeRunner from "@/components/CodeRunner";
import { LANGUAGES, type Language } from "@/lib/draft";

// 강사용 팀 상세 화면의 최종 병합 코드 보기 + 브라우저 샌드박스 실행기.
// 학생 코드는 읽기 전용으로만 표시하고, 교수님이 언어를 골라 [▶ 실행]으로 동작을 확인할 수 있다.
export default function ClassCodeViewer({ code }: { code: string }) {
  const [language, setLanguage] = useState<Language>(() => {
    const trimmed = code.trim();
    if (/^\s*<!doctype|^\s*<html|^\s*<[a-z]+[\s>]/i.test(trimmed)) return "html";
    if (/^\s*(def |from .+ import |elif\b|print\()/m.test(trimmed)) return "python";
    if (/\b(const|let|var|function|console\.log|=>)\b/.test(trimmed)) return "javascript";
    return "plaintext";
  });

  if (code.trim() === "") {
    return <p className="rounded-xl bg-surface p-4 text-center text-sm text-muted">아직 병합된 코드가 없어요.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-muted">실행하려면 코드 언어를 선택하세요. (브라우저 안에서만 안전하게 실행돼요)</span>
        <label className="flex items-center gap-2 text-xs text-muted">
          언어
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as Language)}
            className="rounded-md border border-line-strong bg-background px-2 py-1 text-xs text-foreground"
          >
            {LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="overflow-hidden rounded-xl border border-line">
        <pre className="max-h-96 overflow-auto bg-surface p-3 font-mono text-xs leading-relaxed">
          <code>{code}</code>
        </pre>
        <CodeRunner key={language} code={code} language={language} />
      </div>
    </div>
  );
}
