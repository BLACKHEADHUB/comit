"use client";

import { useEffect, useRef, useState } from "react";
import { appendOutput, cleanPythonError, inputHint, isRunnable, runnerDocument, RUN_TIMEOUT_MS, type OutputLine, type RunLanguage } from "@/lib/runner";
import { badge, btnGhost, btnSecondary } from "@/lib/ui";

type Status = "idle" | "running" | "done" | "timeout";

// 에디터 아래 또는 옆의 [▶ 실행] 패널. 코드는 내 브라우저 안의 격리된 공간에서만 실행된다 (서버에서는 실행하지 않는다).
// JavaScript·Python은 결과(출력)를, HTML은 미리보기를 보여준다
export default function CodeRunner({
  code,
  language,
  layout = "bottom",
}: {
  code: string;
  language: string;
  layout?: "bottom" | "side";
}) {
  const [lines, setLines] = useState<OutputLine[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [loadingText, setLoadingText] = useState("");
  const [preview, setPreview] = useState<string | null>(null); // HTML 미리보기에 넣은 코드
  const [liveHtml, setLiveHtml] = useState(false); // HTML 실시간 자동 미리보기
  const hostRef = useRef<HTMLDivElement>(null);
  const stopRef = useRef<() => void>(() => {});

  // 화면을 떠나면 실행 중인 것을 멈춘다 (언어를 바꾸면 부모가 key로 새로 그려서 결과도 비워진다)
  useEffect(() => {
    return () => stopRef.current();
  }, []);

  // 실시간 HTML 미리보기가 켜져 있으면 입력 멈춤 후 300ms 뒤 자동 갱신
  useEffect(() => {
    if (language !== "html" || !liveHtml) return;
    const t = setTimeout(() => setPreview(code), 300);
    return () => clearTimeout(t);
  }, [code, language, liveHtml]);

  const isSide = layout === "side";

  if (language === "html") {
    return (
      <div className={isSide ? "flex h-full flex-col border-t border-line bg-surface lg:border-t-0 lg:border-l" : "border-t border-line bg-surface"}>
        <div className="flex flex-wrap items-center gap-2 border-b border-line/60 px-3 py-1.5 text-xs text-muted">
          <button
            type="button"
            onClick={() => setPreview(code)}
            className={`${btnSecondary} !px-3 !py-1 !text-xs`}
          >
            ▶ 미리보기
          </button>
          <label className="flex cursor-pointer items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] hover:bg-background">
            <input
              type="checkbox"
              checked={liveHtml}
              onChange={(e) => {
                setLiveHtml(e.target.checked);
                if (e.target.checked) setPreview(code);
              }}
              className="size-3.5 accent-[var(--accent)]"
            />
            자동 반영
          </label>
          {preview !== null && (
            <button type="button" onClick={() => setPreview(null)} className={`${btnGhost} ml-auto !px-2 !py-1 !text-xs`}>
              닫기
            </button>
          )}
          {!isSide && <span className="ml-auto hidden sm:inline">내 브라우저 안의 격리된 공간에서만 보여줘요.</span>}
        </div>
        {preview !== null ? (
          // sandbox: 스크립트만 허용하고 우리 사이트와는 다른 출처로 취급한다 (쿠키·화면에 접근 불가, 팝업·페이지 이동 불가)
          <iframe
            title="HTML 미리보기"
            sandbox="allow-scripts"
            srcDoc={preview}
            className={isSide ? "min-h-0 w-full flex-1 bg-white" : "h-60 w-full bg-white"}
          />
        ) : isSide ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-xs text-muted">
            <span className={`${badge} bg-background ring-1 ring-line`}>HTML 미리보기</span>
            <p>위의 <strong>▶ 미리보기</strong> 또는 <strong>자동 반영</strong>을 켜면 여기에 화면이 나타나요.</p>
          </div>
        ) : null}
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

  const showPanel = status !== "idle" || isSide;
  return (
    <div
      className={isSide ? "flex h-full flex-col border-t border-line bg-surface lg:border-t-0 lg:border-l" : "border-t border-line bg-surface"}
      ref={hostRef}
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-line/60 px-3 py-1.5 text-xs text-muted">
        {status === "running" ? (
          <button type="button" onClick={stop} className={`${btnSecondary} !px-3 !py-1 !text-xs`}>
            ■ 멈추기
          </button>
        ) : (
          <button type="button" onClick={run} className={`${btnSecondary} !px-3 !py-1 !text-xs`}>
            ▶ 실행
          </button>
        )}
        {status !== "idle" && status !== "running" && (
          <button
            type="button"
            onClick={() => {
              setStatus("idle");
              setLines([]);
            }}
            className={`${btnGhost} ml-auto !px-2 !py-1 !text-xs`}
          >
            {isSide ? "비우기" : "결과 닫기"}
          </button>
        )}
        {!isSide && <span className="ml-auto hidden sm:inline">내 브라우저 안의 격리된 공간에서만 실행돼요. 입력(input)은 아직 못 받아요.</span>}
      </div>
      {showPanel && (
        <pre
          role="log"
          aria-label="실행 결과"
          aria-live="polite"
          className={
            isSide
              ? "min-h-0 flex-1 overflow-auto bg-background px-4 py-3 font-mono text-xs leading-relaxed"
              : "max-h-52 overflow-auto bg-background px-4 py-2.5 font-mono text-xs leading-relaxed"
          }
        >
          {status === "idle" && isSide && (
            <span className="text-muted">▶ 실행을 누르면 여기에 출력 결과가 보여요. (브라우저 격리 샌드박스)</span>
          )}
          {loadingText && <span className="block text-muted">{loadingText}</span>}
          {lines.map((l, i) => (
            <span key={i} className={`block whitespace-pre-wrap ${l.kind === "err" ? "text-danger" : l.kind === "info" ? "text-muted" : ""}`}>
              {l.text}
            </span>
          ))}
          {status === "running" && !loadingText && lines.length === 0 && <span className="text-muted">실행 중...</span>}
          {status === "done" && lines.length === 0 && (
            <span className="text-muted">(출력 없음) 결과를 보려면 {lang === "python" ? "print()" : "console.log()"}를 써보세요.</span>
          )}
        </pre>
      )}
    </div>
  );
}
