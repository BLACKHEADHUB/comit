import { expect, test, type Page } from "@playwright/test";
import { comit, createProject, openSubmission, setEditorCode } from "./helpers";

const BASE = ["one", "two", "three", "four", "five", "six", ""].join("\n");

async function merge(page: Page) {
  await page.getByRole("button", { name: "병합하기" }).click();
  await page.getByRole("dialog").getByRole("button", { name: /병합하기/ }).click();
}

async function backToProject(page: Page) {
  await page.getByRole("link", { name: /프로젝트로 돌아가기/ }).click();
  await page.locator(".monaco-editor").first().waitFor();
}

// STALE 재제출 도우미: 서로 다른 곳을 고쳤으면 묻지 않고 자동으로 합쳐서 에디터로 가져간다
test("겹치지 않는 변경은 최신 원본 위에 자동으로 다시 얹힌다", async ({ page }) => {
  await createProject(page, "혼자", "다시 얹기");
  await setEditorCode(page, BASE);
  await comit(page, "원본");
  await openSubmission(page, /내 제안/, "원본");
  await merge(page);
  await expect(page.getByText("병합 완료!")).toBeVisible();
  await backToProject(page);

  // 같은 원본에서 두 개의 제출을 만든다: A는 첫 줄, B는 마지막 줄을 고친다
  await setEditorCode(page, BASE.replace("one", "ONE"));
  await comit(page, "A: 첫 줄");
  await setEditorCode(page, BASE.replace("six", "SIX"));
  await comit(page, "B: 마지막 줄");

  await openSubmission(page, /내 제안/, "A: 첫 줄");
  await merge(page);
  await expect(page.getByText("병합 완료!")).toBeVisible();
  await backToProject(page);

  // B는 이전 원본 기준이라 병합하면 STALE
  await openSubmission(page, /내 제안/, "B: 마지막 줄");
  await merge(page);
  await expect(page.getByText("다른 변경이 먼저 병합됐어요")).toBeVisible();

  // 다시 얹기: 겹침이 없으므로 창 없이 바로 에디터로 가고, A와 B의 변경이 모두 들어 있다
  await page.getByRole("button", { name: "최신 원본에 내 변경 다시 얹기" }).click();
  await page.waitForURL(/\/project\/[0-9a-f]{24}$/);
  await page.locator(".monaco-editor").first().waitFor();
  const code = await page.evaluate(() =>
    (window as unknown as { monaco: { editor: { getModels: () => { getValue: () => string }[] } } }).monaco.editor.getModels()[0].getValue()
  );
  expect(code).toBe(BASE.replace("one", "ONE").replace("six", "SIX"));
  // 최신 원본(ONE이 이미 반영됨)과 비교하면 내 변경 1줄만 남는다
  await expect(page.getByText("원본에서 1줄 바뀜")).toBeVisible();

  // 다시 Comit하고 병합하면 이번에는 반영된다
  await comit(page, "B: 마지막 줄 (다시)");
  await openSubmission(page, /내 제안/, "B: 마지막 줄 (다시)");
  await merge(page);
  await expect(page.getByText("병합 완료!")).toBeVisible();
});
