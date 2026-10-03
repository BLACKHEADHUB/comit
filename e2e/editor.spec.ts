import { expect, test } from "@playwright/test";
import { comit, createProject, openSubmission, setEditorCode } from "./helpers";

const BASE = ["line one", "line two", "line three", "line four", "line five", "line six", ""].join("\n");

// 에디터 줄 번호 옆 색 띠가 정확한 줄에 붙는지 확인한다 (추가 / 수정 / 삭제 위치)
test("에디터 변경 줄 표시", async ({ page }, testInfo) => {
  await createProject(page, "띠확인", "색 띠 확인");
  await setEditorCode(page, BASE);
  await comit(page, "원본 만들기");
  await openSubmission(page, /내 제안/, "원본 만들기");
  await page.getByRole("button", { name: "병합하기" }).click();
  await page.getByRole("dialog").getByRole("button", { name: /병합하기/ }).click();
  await expect(page.getByText("병합 완료!")).toBeVisible();
  await page.getByRole("link", { name: /프로젝트로 돌아가기/ }).click();
  await page.locator(".monaco-editor").first().waitFor();

  // 2번 줄 수정, 3번 줄 삭제, 맨 끝에 한 줄 추가
  await setEditorCode(page, ["line one", "line TWO", "line four", "line five", "line six", "line seven", ""].join("\n"));
  await expect(page.getByText("원본에서 3줄 바뀜")).toBeVisible();

  // 띠가 붙은 줄의 세로 위치가 해당 줄 번호의 세로 위치와 같은지 비교한다
  const topOf = async (selector: string) => Math.round((await page.locator(selector).first().boundingBox())!.y);
  const lineTop = async (n: number) =>
    Math.round((await page.locator(".monaco-editor .line-numbers", { hasText: new RegExp(`^${n}$`) }).first().boundingBox())!.y);

  expect(Math.abs((await topOf(".comit-line-modified")) - (await lineTop(2)))).toBeLessThanOrEqual(2); // 수정: 2번 줄
  expect(Math.abs((await topOf(".comit-line-deleted")) - (await lineTop(3)))).toBeLessThanOrEqual(2); // 삭제 위치: 지워진 자리 바로 아래(지금 3번 줄)
  expect(Math.abs((await topOf(".comit-line-added")) - (await lineTop(6)))).toBeLessThanOrEqual(2); // 추가: 6번 줄

  await page.locator(".monaco-editor").first().screenshot({ path: `e2e/screenshots/${testInfo.project.name}/20-editor-marks.png` });
});
