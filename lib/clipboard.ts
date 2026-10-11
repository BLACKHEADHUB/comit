// 글자를 클립보드에 복사한다. 성공하면 true.
// 권한이 없거나 지원하지 않는 환경(일부 인앱 브라우저, http 등)에서는 예외를 던지지 않고 false를 돌려준다
export async function copyText(text: string): Promise<boolean> {
  try {
    if (!navigator.clipboard?.writeText) return false;
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// 복사에 실패했을 때의 대체 수단: 사용자가 직접 복사할 수 있게 글자를 보여준다
export function showForManualCopy(text: string, message = "아래 링크를 길게 눌러(또는 Ctrl+C로) 복사해 팀원에게 보내주세요.") {
  window.prompt(message, text);
}
