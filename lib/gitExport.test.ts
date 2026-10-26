import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { buildGitRepo, crc32, fileNameFor, orderMerges, zipFiles, type MergedRecord } from "@/lib/gitExport";

const at = (min: number) => new Date(Date.UTC(2026, 9, 1, 0, min));
const rec = (title: string, before: string, after: string, min: number, author = "민수"): MergedRecord => ({ title, author, beforeCode: before, afterCode: after, createdAt: at(min) });

// 이 컴퓨터에 git이 있을 때만 "진짜 git이 읽을 수 있는지" 확인한다 (CI의 Ubuntu에는 있다)
const hasGit = (() => {
  try {
    execFileSync("git", ["--version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

const dirs: string[] = [];
afterAll(() => dirs.forEach((d) => rmSync(d, { recursive: true, force: true })));

function writeRepo(files: Map<string, Buffer>): string {
  const dir = mkdtempSync(join(tmpdir(), "comit-git-"));
  dirs.push(dir);
  for (const [path, data] of files) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), data);
  }
  return dir;
}

const git = (dir: string, ...args: string[]) => execFileSync("git", ["-C", dir, ...args], { encoding: "utf8" }).trim();

describe("orderMerges", () => {
  it("beforeCode를 따라 실제 병합 순서로 잇는다 (만든 순서와 달라도)", () => {
    const a = rec("A", "", "1\n", 5);
    const b = rec("B", "1\n", "1\n2\n", 1); // 먼저 만들었지만 A 다음에 병합됨
    expect(orderMerges([b, a]).map((r) => r.title)).toEqual(["A", "B"]);
  });

  it("이어지지 않으면 남은 것 중 먼저 만든 것", () => {
    expect(orderMerges([rec("X", "zzz", "1", 3), rec("Y", "yyy", "2", 2)]).map((r) => r.title)).toEqual(["Y", "X"]);
  });
});

describe("fileNameFor", () => {
  it("언어에 맞는 확장자", () => {
    expect(fileNameFor("python")).toBe("main.py");
    expect(fileNameFor("javascript")).toBe("main.js");
    expect(fileNameFor(null)).toBe("main.txt");
  });
});

describe("crc32", () => {
  it("알려진 값과 같다", () => {
    expect(crc32(Buffer.from("123456789"))).toBe(0xcbf43926);
  });
});

describe.skipIf(!hasGit)("buildGitRepo (진짜 git으로 확인)", () => {
  const merges = [rec("첫 코드", "", "print(1)\n", 1, "팀장"), rec("두 번째 줄 추가", "print(1)\n", "print(1)\nprint(2)\n", 2, "민<수>")];

  it("커밋 기록·작성자·최종 파일이 맞고, git fsck와 git status가 깨끗하다", () => {
    const dir = writeRepo(buildGitRepo(merges, "print(1)\nprint(2)\n", "main.py").files);
    expect(git(dir, "log", "--format=%an|%s")).toBe("민수|두 번째 줄 추가\n팀장|첫 코드");
    expect(git(dir, "show", "HEAD:main.py")).toBe("print(1)\nprint(2)");
    expect(git(dir, "branch", "--show-current")).toBe("main");
    git(dir, "fsck", "--strict");
    expect(git(dir, "status", "--porcelain")).toBe("");
  });

  it("기록과 지금 원본이 다르면 마지막에 원본 커밋을 하나 더 만든다", () => {
    const dir = writeRepo(buildGitRepo(merges, "print(3)\n", "main.py").files);
    expect(git(dir, "log", "-1", "--format=%s")).toBe("Comit에서 내보낸 시점의 원본");
    expect(git(dir, "rev-list", "--count", "HEAD")).toBe("3");
    expect(git(dir, "status", "--porcelain")).toBe("");
  });
});

describe("zipFiles", () => {
  it("zip 형식의 시작·끝 표시가 있다", () => {
    const zip = zipFiles(new Map([["a.txt", Buffer.from("hi")], ["폴더/한글.md", Buffer.from("안녕")]]));
    expect(zip.readUInt32LE(0)).toBe(0x04034b50);
    expect(zip.readUInt32LE(zip.length - 22)).toBe(0x06054b50);
    expect(zip.readUInt16LE(zip.length - 12)).toBe(2);
  });

  it.skipIf(!hasGit)("python zipfile로 풀면 내용이 같다", () => {
    const dir = mkdtempSync(join(tmpdir(), "comit-zip-"));
    dirs.push(dir);
    const path = join(dir, "t.zip");
    writeFileSync(path, zipFiles(new Map([["폴더/한글.md", Buffer.from("안녕")]])));
    try {
      const out = execFileSync("python3", ["-I", "-c", "import sys,zipfile;z=zipfile.ZipFile(sys.argv[1]);assert z.testzip() is None;print(z.read('폴더/한글.md').decode())", path], { encoding: "utf8" });
      expect(out.trim()).toBe("안녕");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return; // python이 없으면 건너뛴다
      throw error;
    }
  });
});
