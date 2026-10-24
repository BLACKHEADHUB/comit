// 브라우저 안 코드 실행 (서버에서는 절대 실행하지 않는다).
// 실행은 sandbox iframe(allow-scripts만, 다른 출처 취급) 안의 Web Worker에서 한다.
// - 다른 출처라서 우리 사이트의 쿠키·화면·저장소에 손댈 수 없다 (팀원이 올린 코드를 실행해도 내 계정으로 무언가를 할 수 없다)
// - Worker라서 무한 루프가 돌아도 화면이 멈추지 않고, 시간이 지나면 iframe째 지워서 멈춘다

export type RunLanguage = "javascript" | "python";
export type OutputLine = { kind: "out" | "err" | "info"; text: string };

export const isRunnable = (language: string): language is RunLanguage => language === "javascript" || language === "python";

// 실행 시간 한도 (Python은 처음에 실행기를 내려받는 시간이 있어서 더 길다)
export const RUN_TIMEOUT_MS: Record<RunLanguage, number> = { javascript: 5_000, python: 30_000 };
export const MAX_OUTPUT_LINES = 300;
const MAX_LINE_CHARS = 2_000;

// Pyodide: 브라우저에서 도는 Python. CDN에서 버전을 고정해 불러온다
export const PYODIDE_URL = "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js";

// 출력 줄을 쌓는다. 너무 많으면 잘라서 화면이 느려지지 않게 한다
export function appendOutput(lines: OutputLine[], line: OutputLine): OutputLine[] {
  if (lines.length > MAX_OUTPUT_LINES) return lines;
  const text = line.text.length > MAX_LINE_CHARS ? `${line.text.slice(0, MAX_LINE_CHARS)}…` : line.text;
  if (lines.length === MAX_OUTPUT_LINES) return [...lines, { kind: "info", text: `출력이 너무 많아서 ${MAX_OUTPUT_LINES}줄까지만 보여줘요.` }];
  return [...lines, { ...line, text }];
}

// Python 오류에서 Pyodide 내부 줄을 빼고, 내 코드에 해당하는 부분만 남긴다
export function cleanPythonError(message: string): string {
  const lines = message.split("\n");
  const kept = lines.filter((l) => !/\/lib\/python3|_pyodide|pyodide\/|^\s*\^+\s*$/.test(l));
  // "File "<exec>", line 3" → "3번 줄"처럼 읽기 쉽게
  return kept
    .map((l) => l.replace(/File "<exec>", line (\d+)(, in <module>)?/, "$1번 줄"))
    .join("\n")
    .trim();
}

// 실행 실패 이유가 입력(input/prompt) 때문이면 따로 알려준다
export function inputHint(code: string, language: RunLanguage, errorText: string): string | null {
  const usesInput = language === "python" ? /\binput\s*\(/.test(code) : /\bprompt\s*\(/.test(code);
  if (!usesInput) return null;
  if (/EOFError|OSError|I\/O error|prompt/.test(errorText) || language === "python") {
    return language === "python"
      ? "input()으로 입력받는 코드는 아직 실행할 수 없어요. 테스트할 값을 변수에 직접 넣어서 실행해보세요."
      : "prompt()로 입력받는 코드는 아직 실행할 수 없어요. 테스트할 값을 변수에 직접 넣어서 실행해보세요.";
  }
  return null;
}

// Worker 안에서 돌릴 JavaScript 실행기. console.log 등을 가로채 부모에게 보낸다
const JS_WORKER = `
const fmt = (v) => {
  if (typeof v === "string") return v;
  try { return JSON.stringify(v, null, 2) ?? String(v); } catch { return String(v); }
};
const send = (kind, args) => postMessage({ type: "line", kind, text: args.map(fmt).join(" ") });
console.log = console.info = console.debug = (...a) => send("out", a);
console.warn = console.error = (...a) => send("err", a);
self.alert = (v) => send("out", [v]);
self.prompt = () => { throw new Error("prompt() 입력은 아직 지원하지 않아요"); };
self.onmessage = async (e) => {
  try {
    const result = new Function(e.data.code)();
    if (result && typeof result.then === "function") await result;
  } catch (err) {
    send("err", [(err && err.name ? err.name + ": " : "") + (err && err.message ? err.message : String(err))]);
  }
  postMessage({ type: "done" });
};
`;

// Worker 안에서 돌릴 Python 실행기 (Pyodide)
const PY_WORKER = `
self.onmessage = async (e) => {
  try {
    postMessage({ type: "status", text: "Python 실행기를 불러오는 중이에요... (처음 한 번은 몇 초 걸려요)" });
    importScripts(${JSON.stringify(PYODIDE_URL)});
    const py = await loadPyodide({
      stdout: (s) => postMessage({ type: "line", kind: "out", text: s }),
      stderr: (s) => postMessage({ type: "line", kind: "err", text: s }),
    });
    py.setStdin({ error: true });
    postMessage({ type: "status", text: "" });
    await py.runPythonAsync(e.data.code);
  } catch (err) {
    postMessage({ type: "pyerror", text: String(err && err.message ? err.message : err) });
  }
  postMessage({ type: "done" });
};
`;

// sandbox iframe의 내용 (srcdoc). 부모가 보낸 코드를 Worker에서 실행하고 결과를 부모에게 돌려준다
export function runnerDocument(language: RunLanguage): string {
  const workerSource = language === "python" ? PY_WORKER : JS_WORKER;
  return `<!doctype html><meta charset="utf-8"><script>
const src = ${JSON.stringify(workerSource)};
window.addEventListener("message", (e) => {
  if (e.source !== parent || !e.data || typeof e.data.code !== "string") return;
  const worker = new Worker(URL.createObjectURL(new Blob([src], { type: "text/javascript" })));
  worker.onmessage = (m) => parent.postMessage(m.data, "*");
  worker.onerror = (err) => { parent.postMessage({ type: "line", kind: "err", text: err.message || "실행 중 오류가 났어요" }, "*"); parent.postMessage({ type: "done" }, "*"); };
  worker.postMessage({ code: e.data.code });
});
parent.postMessage({ type: "ready" }, "*");
</script>`;
}
