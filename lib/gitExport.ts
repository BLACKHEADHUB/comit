import { createHash } from "node:crypto";
import { deflateSync } from "node:zlib";

// 병합 기록을 진짜 Git 저장소(.git 폴더 포함)로 만들어 zip으로 내보낸다.
// Comit에서 협업을 배운 팀이 GitHub로 "졸업"할 때, 지금까지의 기록을 커밋 히스토리로 그대로 가져갈 수 있게 한다.
// Git 프로그램 없이 Git의 저장 형식(objects, refs, index)을 직접 만든다 (외부 라이브러리 없음)

export type MergedRecord = { title: string; author: string; beforeCode: string; afterCode: string; createdAt: Date };

// 병합 순서 복원: 병합은 "제출 당시 원본(beforeCode) == 그때의 원본"일 때만 되므로,
// 빈 코드에서 시작해 beforeCode가 지금 코드와 같은 제출을 차례로 이어 붙이면 실제 병합 순서가 된다.
// 이어지는 제출이 없으면(예전 데이터 등) 남은 것 중 가장 먼저 만든 것을 쓴다
export function orderMerges(records: MergedRecord[]): MergedRecord[] {
  const rest = [...records].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const ordered: MergedRecord[] = [];
  let current = "";
  while (rest.length > 0) {
    let i = rest.findIndex((r) => r.beforeCode === current);
    if (i < 0) i = 0;
    const [next] = rest.splice(i, 1);
    ordered.push(next);
    current = next.afterCode;
  }
  return ordered;
}

// 에디터 언어 → 파일 확장자
export function fileNameFor(language: string | null): string {
  const ext = { javascript: "js", python: "py", html: "html" }[language ?? ""] ?? "txt";
  return `main.${ext}`;
}

type GitObject = { sha: string; data: Buffer };

function gitObject(type: "blob" | "tree" | "commit", body: Buffer): GitObject {
  const raw = Buffer.concat([Buffer.from(`${type} ${body.length}\0`), body]);
  return { sha: createHash("sha1").update(raw).digest("hex"), data: deflateSync(raw) };
}

// Git 이름 칸에 들어가면 안 되는 글자(<, >, 줄바꿈)를 지운다
const safeName = (name: string) => name.replace(/[<>\n\r]/g, "").trim() || "Comit";

// 한국 시간 기준 커밋 시각 ("초 +0900")
const gitTime = (date: Date) => `${Math.floor(date.getTime() / 1000)} +0900`;

// index 파일 (스테이징 영역). 이게 있어야 내려받은 직후 `git status`가 깨끗하다.
// 파일 시각은 0으로 두면 Git이 처음 한 번 내용을 다시 읽어 확인한다
function indexFile(fileName: string, blobSha: string, size: number): Buffer {
  const name = Buffer.from(fileName);
  const entryLength = 62 + name.length;
  const padded = Math.ceil((entryLength + 1) / 8) * 8; // 이름 뒤에 NUL을 1~8개 붙여 8바이트 단위로 맞춘다
  const entry = Buffer.alloc(padded);
  entry.writeUInt32BE(0o100644, 24); // mode: 일반 파일
  entry.writeUInt32BE(size, 36);
  Buffer.from(blobSha, "hex").copy(entry, 40);
  entry.writeUInt16BE(Math.min(name.length, 0xfff), 60);
  name.copy(entry, 62);
  const header = Buffer.alloc(12);
  header.write("DIRC", 0);
  header.writeUInt32BE(2, 4); // 버전 2
  header.writeUInt32BE(1, 8); // 파일 1개
  const body = Buffer.concat([header, entry]);
  return Buffer.concat([body, createHash("sha1").update(body).digest()]);
}

// 저장소의 파일들을 { 경로: 내용 }으로 만든다. 경로는 저장소 폴더 기준 (.git/HEAD, main.py ...)
export function buildGitRepo(merges: MergedRecord[], mainCode: string, fileName: string, now = new Date()): { files: Map<string, Buffer>; commitCount: number } {
  const files = new Map<string, Buffer>();
  const addObject = (obj: GitObject) => files.set(`.git/objects/${obj.sha.slice(0, 2)}/${obj.sha.slice(2)}`, obj.data);

  let parent: string | null = null;
  let lastCode: string | null = null;
  let commitCount = 0;
  const commit = (code: string, message: string, author: string, date: Date) => {
    const blob = gitObject("blob", Buffer.from(code));
    const tree = gitObject("tree", Buffer.concat([Buffer.from(`100644 ${fileName}\0`), Buffer.from(blob.sha, "hex")]));
    const who = `${safeName(author)} <comit@users.noreply.comit> ${gitTime(date)}`;
    const text = `tree ${tree.sha}\n${parent ? `parent ${parent}\n` : ""}author ${who}\ncommitter ${who}\n\n${message}\n`;
    const c = gitObject("commit", Buffer.from(text));
    [blob, tree, c].forEach(addObject);
    parent = c.sha;
    lastCode = code;
    commitCount += 1;
  };

  for (const m of orderMerges(merges)) {
    commit(m.afterCode, `${m.title.replace(/[\r\n]+/g, " ")}\n\nComit에서 ${safeName(m.author)}님이 제출하고 팀장이 병합했어요.`, m.author, m.createdAt);
  }
  // 기록과 지금 원본이 다르면(예전 데이터 등) 지금 원본을 마지막 커밋으로 남긴다
  if (lastCode !== mainCode) commit(mainCode, "Comit에서 내보낸 시점의 원본", "Comit", now);

  const head = parent as string | null;
  files.set(".git/HEAD", Buffer.from("ref: refs/heads/main\n"));
  files.set(".git/config", Buffer.from("[core]\n\trepositoryformatversion = 0\n\tfilemode = false\n\tbare = false\n\tlogallrefupdates = true\n"));
  files.set(".git/refs/heads/main", Buffer.from(`${head}\n`));
  files.set(".git/refs/tags/.keep", Buffer.alloc(0));
  const blobSha = gitObject("blob", Buffer.from(mainCode)).sha;
  files.set(".git/index", indexFile(fileName, blobSha, Buffer.byteLength(mainCode)));
  files.set(fileName, Buffer.from(mainCode));
  return { files, commitCount };
}

// GitHub로 옮기는 방법 + Comit 용어와 Git 용어 연결 (zip 맨 위에 같이 넣는다)
export function githubGuide(folder: string, fileName: string, commitCount: number): string {
  return `# Comit 기록을 GitHub로 옮기기

이 zip 안의 \`${folder}\` 폴더는 진짜 Git 저장소예요. Comit에서 병합된 기록 ${commitCount}개가 커밋으로 들어 있어요.
코드는 \`${fileName}\` 파일에 있어요.

## Comit 말 ↔ Git 말

| Comit에서 | Git·GitHub에서 |
|---|---|
| 원본 | main 브랜치 |
| Comit하기 | 브랜치에 commit 하고 Pull Request(PR) 열기 |
| 리뷰 (👍 ❓ 🐞 댓글) | PR 리뷰 코멘트 |
| 병합 | PR merge |
| 다시 제출 필요 | merge conflict (충돌) → rebase 하거나 main을 merge 하기 |
| 기여도 리포트 | Insights → Contributors |

## 방법 1. GitHub Desktop (터미널 없이)

1. https://desktop.github.com 에서 GitHub Desktop을 설치하고 로그인해요.
2. zip을 풀고, GitHub Desktop에서 File → Add local repository → \`${folder}\` 폴더를 골라요.
3. 오른쪽 위 [Publish repository]를 누르면 GitHub에 저장소가 생기고 기록이 그대로 올라가요.

## 방법 2. 터미널

1. GitHub에서 새 저장소를 만들어요. (README 추가는 체크하지 마세요)
2. zip을 푼 곳에서:

\`\`\`
cd ${folder}
git log --oneline          # 기록 확인
git remote add origin https://github.com/내아이디/저장소이름.git
git push -u origin main
\`\`\`

커밋 작성자 이메일은 개인정보가 담기지 않게 가짜 주소(comit@users.noreply.comit)로 넣었어요.
`;
}

// ---- zip 만들기 (압축 없이 저장만 하는 가장 단순한 형식) ----

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of data) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date: Date): { time: number; day: number } {
  const year = Math.max(date.getFullYear(), 1980);
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    day: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

export function zipFiles(files: Map<string, Buffer>, date = new Date()): Buffer {
  const { time, day } = dosDateTime(date);
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const [path, data] of files) {
    const name = Buffer.from(path); // 한글 파일 이름은 UTF-8 (플래그 0x0800)
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8); // 압축 안 함
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(day, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    locals.push(local, name, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(day, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);
    offset += 30 + name.length + data.length;
  }
  const centralDir = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.size, 8);
  end.writeUInt16LE(files.size, 10);
  end.writeUInt32LE(centralDir.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralDir, end]);
}
