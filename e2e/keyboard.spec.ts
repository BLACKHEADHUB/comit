import { expect, test, type Locator, type Page } from "@playwright/test";
import { createProject } from "./helpers";

// Tab(또는 Shift+Tab)만 눌러 원하는 요소에 포커스가 갈 때까지 이동한다. 마우스는 쓰지 않는다
async function tabTo(page: Page, target: Locator, { back = false, max = 80 } = {}) {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press(back ? "Shift+Tab" : "Tab");
    const focused = await target
      .first()
      .evaluate((el) => el === document.activeElement || el.contains(document.activeElement))
      .catch(() => false);
    if (focused) return;
  }
  throw new Error("Tab으로 요소에 도달하지 못했어요 (키보드로 접근할 수 없는 요소일 수 있어요)");
}

// 접근성: 마우스 없이 키보드만으로 코드 작성 → Comit → 댓글 → 병합까지 갈 수 있어야 한다
test("키보드만으로 Comit → 댓글 → 병합", async ({ page }) => {
  await createProject(page, "키보드", "키보드만으로");
  await page.locator(".monaco-editor").first().waitFor();

  // 1) 에디터로 이동해 코드를 쓰고, Ctrl/⌘+Enter로 Comit 창을 연다 (에디터 안에서는 Tab이 들여쓰기라 단축키가 필요)
  await tabTo(page, page.locator(".monaco-editor"));
  await page.keyboard.type("print('hello keyboard')");
  await page.keyboard.press("ControlOrMeta+Enter");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  // 2) 제목 입력창에 자동으로 포커스가 가 있어야 한다 → 바로 입력하고 Enter로 제출
  await expect(dialog.getByLabel("제출 제목")).toBeFocused();
  await page.keyboard.type("키보드로 올린 제출");
  await page.keyboard.press("Enter");
  await expect(dialog).toBeHidden({ timeout: 30_000 });

  // 3) "내 제안" 탭 → 방금 올린 제출 열기
  await expect(page.getByRole("link", { name: /키보드로 올린 제출/ })).toBeVisible();
  await tabTo(page, page.getByRole("link", { name: /키보드로 올린 제출/ }));
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/submission\//);
  await expect(page.getByRole("button", { name: "1번 줄에 댓글 달기" })).toBeVisible();

  // 4) 1번 줄에 댓글: + 버튼 → (포커스가 폼으로 이동) → 버그 태그 → 내용 → 등록
  await tabTo(page, page.getByRole("button", { name: "1번 줄에 댓글 달기" }));
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: /좋아요/, pressed: true })).toBeFocused();
  await tabTo(page, page.getByRole("button", { name: /버그/ }));
  await page.keyboard.press("Space");
  await tabTo(page, page.getByPlaceholder("내용 (선택)"));
  await page.keyboard.type("키보드로 단 댓글");
  await tabTo(page, page.getByRole("button", { name: "등록하기" }));
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: /1번 줄 댓글 1개 보기/ })).toBeVisible();

  // 5) 병합: 버튼까지 거꾸로 이동 → Enter → 확인 창의 버튼에 자동 포커스 → Enter
  await tabTo(page, page.getByRole("button", { name: "병합하기" }), { back: true });
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog").getByRole("button", { name: /병합하기/ })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByText("병합 완료!")).toBeVisible();
});
