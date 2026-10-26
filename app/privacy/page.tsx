import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";
import { operatorInfo } from "@/lib/contact";
import { EXPIRE_DAYS } from "@/lib/retention";

export const metadata: Metadata = { title: "개인정보 처리방침 · Comit" };

export default function PrivacyPage() {
  const { name, email } = operatorInfo();
  return (
    <LegalPage
      title="개인정보 처리방침"
      intro="Comit은 회원가입이 없고, 서비스에 꼭 필요한 정보만 다뤄요. 어떤 정보를 왜, 얼마나 보관하는지 정리했어요."
    >
      <section>
        <h2>1. 다루는 정보</h2>
        <ul>
          <li>직접 입력한 것: 닉네임, 프로젝트 이름·설명, 제출 제목과 코드, 댓글</li>
          <li>자동으로 생기는 것: 접속 쿠키(내가 어느 멤버인지), 복구 코드의 해시값(원문은 저장하지 않아요)</li>
          <li>남용 방지를 위해 잠깐 쓰는 것: 접속 IP 주소(요청 횟수 제한에만 쓰고, 하루 안에 사라지는 카운터로만 보관해요)</li>
        </ul>
        <p className="mt-1.5">이메일, 전화번호, 실명은 받지 않아요. 코드나 댓글에 개인정보를 적지 말아주세요.</p>
      </section>
      <section>
        <h2>2. 쓰는 목적</h2>
        <ul>
          <li>팀 프로젝트 기능 제공(제출, 리뷰, 병합)과 멤버 확인</li>
          <li>AI 요약·경고·개념 설명 만들기</li>
          <li>도배·비용 폭주 같은 남용 막기</li>
        </ul>
      </section>
      <section>
        <h2>3. 보관 기간</h2>
        <ul>
          <li>프로젝트 데이터: 마지막 활동 후 {EXPIRE_DAYS}일이 지나거나 팀장이 지우면 함께 지워져요.</li>
          <li>팀에서 내보내진 멤버의 정보는 바로 멤버 목록에서 빠져요(그동안 쓴 제출·댓글은 닉네임과 함께 남아요).</li>
          <li>접속 쿠키: 30일. 요청 횟수 카운터: 최대 하루.</li>
        </ul>
      </section>
      <section>
        <h2>4. 다른 곳에 맡기거나 보내는 정보</h2>
        <ul>
          <li><strong>Google (Gemini API)</strong>: 제출의 바뀐 부분(diff)과 AI에게 한 질문을 보내 분석을 받아요. 닉네임은 보내지 않아요.</li>
          <li><strong>MongoDB Atlas</strong>: 프로젝트·제출·댓글 저장</li>
          <li><strong>Upstash (Redis)</strong>: AI 결과 임시 저장(24시간)과 요청 횟수 제한</li>
          <li><strong>Vercel</strong>: 서비스 호스팅과 접속 기록</li>
        </ul>
        <p className="mt-1.5">이 회사들의 서버는 해외에 있을 수 있어요. 위 목적 밖으로 정보를 팔거나 넘기지 않고, 광고에 쓰지 않아요.</p>
      </section>
      <section>
        <h2>5. 내 정보 지우기</h2>
        <ul>
          <li>내 제출(병합 전)과 내 댓글은 직접 지울 수 있어요.</li>
          <li>프로젝트 전체는 팀장이 멤버 메뉴에서 지울 수 있어요.</li>
          <li>그 밖의 삭제·열람 요청은 아래 문의처로 보내주세요.</li>
        </ul>
      </section>
      <section>
        <h2>6. 문의처</h2>
        <p>
          개인정보 보호 책임: {name} · {email ? <a className="underline" href={`mailto:${email}`}>{email}</a> : "문의처 준비 중"}
        </p>
      </section>
    </LegalPage>
  );
}
