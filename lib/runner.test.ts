import { describe, expect, it } from "vitest";
import { appendOutput, cleanPythonError, inputHint, isRunnable, MAX_OUTPUT_LINES, runnerDocument, type OutputLine } from "@/lib/runner";

describe("isRunnable", () => {
  it("JavaScript와 Python만 실행할 수 있다", () => {
    expect(isRunnable("javascript")).toBe(true);
    expect(isRunnable("python")).toBe(true);
    expect(isRunnable("plaintext")).toBe(false);
    expect(isRunnable("html")).toBe(false);
  });
});

describe("appendOutput", () => {
  it("한도를 넘으면 안내 한 줄을 붙이고 더 쌓지 않는다", () => {
    let lines: OutputLine[] = [];
    for (let i = 0; i < MAX_OUTPUT_LINES + 50; i++) lines = appendOutput(lines, { kind: "out", text: String(i) });
    expect(lines).toHaveLength(MAX_OUTPUT_LINES + 1);
    expect(lines.at(-1)?.kind).toBe("info");
  });

  it("아주 긴 줄은 자른다", () => {
    const [line] = appendOutput([], { kind: "out", text: "x".repeat(5000) });
    expect(line.text.length).toBeLessThan(2100);
  });
});

describe("cleanPythonError", () => {
  it("Pyodide 내부 줄을 빼고 내 코드 줄 번호만 남긴다", () => {
    const raw = [
      "Traceback (most recent call last):",
      '  File "/lib/python312.zip/_pyodide/_base.py", line 573, in eval_code_async',
      "    await CodeRunner(",
      '  File "<exec>", line 2, in <module>',
      "ZeroDivisionError: division by zero",
    ].join("\n");
    const cleaned = cleanPythonError(raw);
    expect(cleaned).not.toContain("_pyodide");
    expect(cleaned).toContain("2번 줄");
    expect(cleaned).toContain("ZeroDivisionError");
  });
});

describe("inputHint", () => {
  it("input()을 쓰는 Python 코드가 실패하면 안내한다", () => {
    expect(inputHint("name = input()", "python", "OSError: [Errno 29] I/O error")).toContain("input()");
    expect(inputHint("print(1/0)", "python", "ZeroDivisionError")).toBeNull();
  });

  it("prompt()를 쓰는 JS 코드도 안내한다", () => {
    expect(inputHint("const a = prompt('?')", "javascript", "Error: prompt() 입력은 아직 지원하지 않아요")).toContain("prompt()");
  });
});

describe("runnerDocument", () => {
  it("코드를 문서에 직접 넣지 않고, 메시지로 받아 Worker에서 실행한다", () => {
    const doc = runnerDocument("javascript");
    expect(doc).toContain("new Worker");
    expect(doc).toContain("e.source !== parent");
  });

  it("Python은 Pyodide를 고정된 버전으로 불러온다", () => {
    expect(runnerDocument("python")).toMatch(/pyodide\/v\d+\.\d+\.\d+\/full\/pyodide\.js/);
  });
});
