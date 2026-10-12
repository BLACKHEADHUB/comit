import { expect, type Page, type TestInfo } from "@playwright/test";

// 화면 스크린샷을 e2e/screenshots/<프로젝트 이름>/<이름>.png로 저장한다 (사람이 직접 열어 보는 용도)
export async function shot(page: Page, testInfo: TestInfo, name: string) {
  await page.waitForTimeout(300); // 모달/카드가 나타나는 애니메이션이 끝난 뒤에 찍는다
  await page.screenshot({ path: `e2e/screenshots/${testInfo.project.name}/${name}.png`, fullPage: true });
}

// 가로 스크롤이 생기지 않았는지 확인 (페이지 전체가 옆으로 밀리면 안 된다)
export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, "페이지에 가로 스크롤이 생겼어요").toBeLessThanOrEqual(1);
}

// 랜딩 → 프로젝트 생성. 초대 링크를 돌려주고, 프로젝트 화면까지 이동한다
export async function createProject(page: Page, nickname: string, title: string): Promise<string> {
  await page.goto("/project/create");
  await page.locator('input[name="nickname"]').fill(nickname);
  await page.locator('input[name="title"]').fill(title);
  await page.getByText("빈 코드", { exact: true }).click(); // 테스트는 빈 원본에서 시작한다
  await page.getByRole("button", { name: "프로젝트 만들기" }).click();
  const inviteUrl = (await page.locator("code").innerText()).trim();
  await page.getByRole("link", { name: /프로젝트로 이동/ }).click();
  await page.waitForURL(/\/project\/[0-9a-f]{24}$/);
  return inviteUrl;
}

// 초대 링크로 합류
export async function joinProject(page: Page, inviteUrl: string, nickname: string) {
  await page.goto(new URL(inviteUrl).pathname);
  await page.locator('input[name="nickname"]').fill(nickname);
  await page.getByRole("button", { name: "합류하기" }).click();
  await page.waitForURL(/\/project\/[0-9a-f]{24}$/);
}

// Monaco 에디터의 내용을 통째로 바꾼다 (자동 들여쓰기/괄호 완성의 영향을 받지 않도록 모델에 직접 넣는다)
export async function setEditorCode(page: Page, code: string) {
  await page.locator(".monaco-editor").first().waitFor();
  await page.evaluate((value) => {
    const monaco = (window as unknown as { monaco: { editor: { getModels: () => { setValue: (v: string) => void }[] } } }).monaco;
    monaco.editor.getModels()[0].setValue(value);
  }, code);
}

// [Comit하기] → 제목 입력 → 제출
export async function comit(page: Page, title: string) {
  await page.getByRole("button", { name: "Comit하기" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("제출 제목").fill(title);
  await dialog.getByRole("button", { name: "제출하기" }).click();
  await expect(dialog).toBeHidden({ timeout: 30_000 });
}

// 좁은 화면에서는 제출 목록이 접혀 있으므로 펼친다 (넓은 화면에서는 버튼이 숨어 있어 아무것도 하지 않는다)
export async function showList(page: Page, { keyboard = false } = {}) {
  const toggle = page.getByRole("button", { name: /제출 목록 \d+개/ });
  if (!(await toggle.isVisible()) || (await toggle.getAttribute("aria-expanded")) === "true") return;
  if (keyboard) {
    await toggle.focus();
    await page.keyboard.press("Enter");
  } else {
    await toggle.click();
  }
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
}

// 사이드바에서 탭을 고르고 제목으로 제출을 연다
export async function openSubmission(page: Page, tab: RegExp, title: string) {
  await showList(page);
  await page.getByRole("tab", { name: tab }).click();
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // 제목의 괄호 등을 글자 그대로 찾는다
  await page.getByRole("link", { name: new RegExp(escaped) }).click();
  await page.waitForURL(/\/submission\//);
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
}

// 페이지에서 난 오류(스크립트 예외, 콘솔 error)를 모은다. hydration 불일치는 React 오류(#418 등)로 여기에 잡힌다
export function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  return errors;
}
