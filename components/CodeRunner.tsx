"use client";

import { useEffect, useRef, useState } from "react";
import { appendOutput, cleanPythonError, inputHint, isRunnable, runnerDocument, RUN_TIMEOUT_MS, type OutputLine, type RunLanguage } from "@/lib/runner";
import { btnGhost, btnSecondary } from "@/lib/ui";

type Status = "idle" | "running" | "done" | "timeout";

// 에디터 아래의 [▶ 실행] 줄. 코드는 내 브라우저 안의 격리된 공간에서만 실행된다 (서버에서는 실행하지 않는다).
// JavaScript·Python은 결과(출력)를, HTML은 미리보기를 보여준다
export default function CodeRunner({ code, language }: { code: string; language: string }) {
  const [lines, setLines] = useState<OutputLine[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [loadingText, setLoadingText] = useState("");
  const [preview, setPreview] = useState<string | null>(null); // HTML 미리보기에 넣은 코드
  const hostRef = useRef<HTMLDivElement>(null);
  const stopRef = useRef<() => void>(() => {});

  // 화면을 떠나면 실행 중인 것을 멈춘다 (언어를 바꾸면 부모가 key로 새로 그려서 결과도 비워진다)
  useEffect(() => {
    return () => stopRef.current();
  }, []);

  if (language === "html") {
    return (
      <div className="border-t border-line bg-surface">
        <div className="flex flex-wrap items-center gap-2 px-4 py-1.5 text-xs text-muted">
          <button type="button" onClick={() => setPreview(code)} className={`${btnSecondary} !px-3 !py-1 !text-xs`}>
            ▶ 미리보기
          </button>
          {preview !== null && (
            <button type="button" onClick={() => setPreview(null)} className={`${btnGhost} !px-2 !py-1 !text-xs`}>
              닫기
            </button>
          )}
          <span>내 브라우저 안의 격리된 공간에서만 보여줘요.</span>
        </div>
        {preview !== null && (
          // sandbox: 스크립트만 허용하고 우리 사이트와는 다른 출처로 취급한다 (쿠키·화면에 접근 불가, 팝업·페이지 이동 불가)
          <iframe title="HTML 미리보기" sandbox="allow-scripts" srcDoc={preview} className="h-56 w-full border-t border-line bg-white" />
        )}
      </div>
    );
  }

  if (!isRunnable(language)) return null;
  const lang: RunLanguage = language;

  function run() {
    stopRef.current();
    setLines([]);
    setLoadingText("");
    setStatus("running");
    const runCode = code;

    // 실행할 때마다 새 sandbox iframe을 만든다. 끝나거나 시간이 지나면 iframe째 지워서 Worker까지 멈춘다
    const frame = document.createElement("iframe");
    frame.setAttribute("sandbox", "allow-scripts");
    frame.setAttribute("aria-hidden", "true");
    frame.style.display = "none";
    frame.srcdoc = runnerDocument(lang);

    let finished = false;
    let pyError = "";
    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      clearTimeout(timer);
      frame.remove();
    };
    const finish = (next: Status) => {
      if (finished) return;
      finished = true;
      setLoadingText("");
      setStatus(next);
      if (next === "timeout") {
        setLines((prev) => appendOutput(prev, { kind: "err", text: `${RUN_TIMEOUT_MS[lang] / 1000}초가 지나 멈췄어요. 끝나지 않는 반복문이 있는지 확인해보세요.` }));
      }
      // 끝난 뒤 잠깐 남은 출력(setTimeout 등)을 받을 시간을 주고 정리한다
      setTimeout(cleanup, next === "done" ? 1000 : 0);
    };
    const onMessage = (e: MessageEvent) => {
      // 내가 만든 iframe에서 온 메시지만 받는다
      if (e.source !== frame.contentWindow || !e.data || typeof e.data !== "object") return;
      const data = e.data as { type?: string; kind?: OutputLine["kind"]; text?: string };
      if (data.type === "ready") frame.contentWindow?.postMessage({ code: runCode }, "*");
      else if (data.type === "status") setLoadingText(String(data.text ?? ""));
      else if (data.type === "line") setLines((prev) => appendOutput(prev, { kind: data.kind === "err" ? "err" : "out", text: String(data.text ?? "") }));
      else if (data.type === "pyerror") {
        pyError = cleanPythonError(String(data.text ?? ""));
        setLines((prev) => appendOutput(prev, { kind: "err", text: pyError }));
      } else if (data.type === "done") {
        const hint = inputHint(runCode, lang, pyError);
        if (hint && pyError) setLines((prev) => appendOutput(prev, { kind: "info", text: hint }));
        finish("done");
      }
    };
    window.addEventListener("message", onMessage);
    const timer = setTimeout(() => finish("timeout"), RUN_TIMEOUT_MS[lang]);
    stopRef.current = () => {
      finished = true;
      cleanup();
    };
    (hostRef.current ?? document.body).appendChild(frame);
  }

  function stop() {
    stopRef.current();
    setLoadingText("");
    setStatus("done");
    setLines((prev) => appendOutput(prev, { kind: "info", text: "실행을 멈췄어요." }));
  }

  const showPanel = status !== "idle";
  return (
    <div className="border-t border-line bg-surface" ref={hostRef}>
      <div className="flex flex-wrap items-center gap-2 px-4 py-1.5 text-xs text-muted">
        {status === "running" ? (
          <button type="button" onClick={stop} className={`${btnSecondary} !px-3 !py-1 !text-xs`}>
            ■ 멈추기
          </button>
        ) : (
          <button type="button" onClick={run} className={`${btnSecondary} !px-3 !py-1 !text-xs`}>
            ▶ 실행
          </button>
        )}
        {showPanel && status !== "running" && (
          <button type="button" onClick={() => { setStatus("idle"); setLines([]); }} className={`${btnGhost} !px-2 !py-1 !text-xs`}>
            결과 닫기
          </button>
        )}
        <span>내 브라우저 안의 격리된 공간에서만 실행돼요. 입력(input)은 아직 못 받아요.</span>
      </div>
      {showPanel && (
        <pre role="log" aria-label="실행 결과" aria-live="polite" className="max-h-48 overflow-auto border-t border-line bg-background px-4 py-2 font-mono text-xs leading-relaxed">
          {loadingText && <span className="block text-muted">{loadingText}</span>}
          {lines.map((l, i) => (
            <span key={i} className={`block whitespace-pre-wrap ${l.kind === "err" ? "text-danger" : l.kind === "info" ? "text-muted" : ""}`}>
              {l.text}
            </span>
          ))}
          {status === "running" && !loadingText && lines.length === 0 && <span className="text-muted">실행 중...</span>}
          {status === "done" && lines.length === 0 && <span className="text-muted">(출력 없음) 결과를 보려면 {lang === "python" ? "print()" : "console.log()"}를 써보세요.</span>}
        </pre>
      )}
    </div>
  );
}
