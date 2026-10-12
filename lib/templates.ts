// 새 프로젝트를 만들 때 고를 수 있는 시작 코드.
// 빈 에디터 앞에서 막막하지 않도록, 바로 고쳐볼 수 있는 짧은 예제를 원본(mainCode)으로 넣어준다.
export type StarterTemplate = { id: string; label: string; code: string };

export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    id: "python",
    label: "Python",
    code: `# 여기서부터 고쳐보세요!
def greet(name):
    return f"안녕, {name}!"


print(greet("코밋"))
`,
  },
  {
    id: "javascript",
    label: "JavaScript",
    code: `// 여기서부터 고쳐보세요!
function greet(name) {
  return \`안녕, \${name}!\`;
}

console.log(greet("코밋"));
`,
  },
  {
    id: "html",
    label: "HTML",
    code: `<!-- 여기서부터 고쳐보세요! -->
<!DOCTYPE html>
<html lang="ko">
  <body>
    <h1>안녕, 코밋!</h1>
    <p>이 문장을 바꿔서 Comit해보세요.</p>
  </body>
</html>
`,
  },
  { id: "empty", label: "빈 코드", code: "" },
];

export const DEFAULT_TEMPLATE_ID = "python";

// 알 수 없는 id(조작된 값 포함)는 빈 코드로 취급한다
export function starterCode(id: string | null | undefined): string {
  return STARTER_TEMPLATES.find((t) => t.id === id)?.code ?? "";
}
