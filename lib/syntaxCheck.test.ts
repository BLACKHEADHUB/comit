import { describe, expect, it } from "vitest";
import { checkBracketBalance, checkMergeSyntax } from "./syntaxCheck";

describe("checkBracketBalance", () => {
  it("정상적인 괄호와 문자열/주석 안의 괄호는 통과한다", () => {
    expect(checkBracketBalance('const msg = "(안녕)"; // {\nfunction f() { return [1, 2]; }')).toBeNull();
    expect(checkBracketBalance("def hello(name):\n    # (주석\n    print(name)\n")).toBeNull();
  });

  it("닫히지 않았거나 짝이 틀린 괄호를 찾아낸다", () => {
    expect(checkBracketBalance("function a() {\n  console.log(1);\n")?.reason).toContain("닫히지 않았어요");
    expect(checkBracketBalance("const x = [1, 2);")?.reason).toContain("짝이 맞지 않아요");
    expect(checkBracketBalance("console.log(1));")?.reason).toContain("짝이 없는 ')'");
  });
});

describe("checkMergeSyntax", () => {
  it("JavaScript 문법 오류를 감지하고 실행은 하지 않는다", () => {
    const res = checkMergeSyntax("const x = ;");
    expect(res?.reason).toContain("JavaScript 문법 오류");
  });

  it("Python이나 HTML 코드는 JS 파서 오탐 없이 통과한다", () => {
    expect(checkMergeSyntax("def add(a, b):\n    return a + b\n")).toBeNull();
    expect(checkMergeSyntax("<div><h1>안녕</h1></div>")).toBeNull();
  });
});
