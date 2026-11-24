// 병합 전 브라우저에서 가볍게 문법 실수(괄호 짝 불일치, JS SyntaxError)를 확인하는 순수 함수.
// 코드를 절대 실행하지 않고(new Function 생성만 사용, 호출 안 함) 구문만 검사한다.

export type SyntaxWarning = {
  reason: string;
};

// 문자열과 주석을 건너뛰고 (), {}, [] 괄호 짝이 맞는지 검사한다
export function checkBracketBalance(code: string): SyntaxWarning | null {
  const stack: { ch: string; line: number }[] = [];
  const pairs: Record<string, string> = { "(": ")", "{": "}", "[": "]" };
  const closeToOpen: Record<string, string> = { ")": "(", "}": "{", "]": "[" };

  let line = 1;
  let quote: "'" | '"' | "`" | null = null;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < code.length; i++) {
    const ch = code[i];
    const next = code[i + 1];

    if (ch === "\n") {
      line++;
      inLineComment = false;
      if (quote === "'" || quote === '"') quote = null;
      continue;
    }
    if (inLineComment) continue;

    if (inBlockComment) {
      if (ch === "*" && next === "/") {
        inBlockComment = false;
        i++;
      }
      continue;
    }

    if (quote) {
      if (ch === "\\") {
        i++; // 이스케이프 문자 건너뜀
      } else if (ch === quote) {
        quote = null;
      }
      continue;
    }

    // 주석 시작
    if (ch === "/" && next === "/") {
      inLineComment = true;
      i++;
      continue;
    }
    if (ch === "/" && next === "*") {
      inBlockComment = true;
      i++;
      continue;
    }
    if (ch === "#") {
      inLineComment = true;
      continue;
    }

    // 문자열 시작
    if (ch === "'" || ch === '"' || ch === "`") {
      quote = ch;
      continue;
    }

    if (pairs[ch]) {
      stack.push({ ch, line });
    } else if (closeToOpen[ch]) {
      const top = stack.pop();
      if (!top) {
        return { reason: `${line}번 줄에 짝이 없는 '${ch}'가 있어요.` };
      }
      if (top.ch !== closeToOpen[ch]) {
        return { reason: `${top.line}번 줄의 '${top.ch}'와 ${line}번 줄의 '${ch}' 짝이 맞지 않아요.` };
      }
    }
  }

  if (stack.length > 0) {
    const unclosed = stack[stack.length - 1];
    return { reason: `${unclosed.line}번 줄에서 연 '${unclosed.ch}'가 닫히지 않았어요.` };
  }

  return null;
}

// JavaScript처럼 보이는 코드일 때만 new Function으로 구문 오류(SyntaxError)를 추가 확인한다
function looksLikeJavaScript(code: string): boolean {
  const trimmed = code.trim();
  if (!trimmed) return false;
  // HTML이나 Python 특징이 보이면 JS 파서로 검사하지 않는다 (오탐 방지)
  if (/^\s*<!doctype|^\s*<html|^\s*<[a-z]+[\s>]/i.test(trimmed)) return false;
  if (/^\s*(def |class .*:|from .+ import |elif\b|print\()/m.test(trimmed)) return false;
  return /\b(const|let|var|function|console\.log|=>)\b/.test(trimmed);
}

export function checkMergeSyntax(code: string): SyntaxWarning | null {
  if (!code.trim()) return null;

  const bracket = checkBracketBalance(code);
  if (bracket) return bracket;

  if (looksLikeJavaScript(code)) {
    try {
      // ESM import/export가 없는 일반 JS 코드만 파싱 검사 (실행은 절대 하지 않음)
      if (!/^\s*(import|export)\b/m.test(code)) {
        new Function(code);
      }
    } catch (error) {
      if (error instanceof SyntaxError) {
        return { reason: `JavaScript 문법 오류: ${error.message}` };
      }
    }
  }

  return null;
}
