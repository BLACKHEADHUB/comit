import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";
import { operatorInfo } from "@/lib/contact";
import { EXPIRE_DAYS } from "@/lib/retention";

export const metadata: Metadata = { title: "이용약관 · Comit" };

export default function TermsPage() {
  const { name, email } = operatorInfo();
  return (
    <LegalPage title="이용약관" intro={`Comit(이하 "서비스")을 쓰기 전에 꼭 알아둘 규칙이에요. 프로젝트를 만들거나 초대 링크로 합류하면 이 약관에 동의한 것으로 봐요.`}>
      <section>
        <h2>1. 서비스가 하는 일</h2>
        <p>
          웹에서 코드를 고치고, 바뀐 부분을 팀에 제출하고, AI 요약과 줄별 댓글로 리뷰한 뒤, 팀장이 병합하는 학습용 협업 공간이에요.
          올린 코드는 <strong>실행하지 않고 글자로만</strong> 저장하고 보여줘요.
        </p>
      </section>
      <section>
        <h2>2. 계정과 접속</h2>
        <ul>
          <li>회원가입 없이 닉네임으로 참여하고, 브라우저 쿠키로 &ldquo;나&rdquo;를 기억해요.</li>
          <li>쿠키를 지우거나 기기를 바꾸면 처음 받은 <strong>복구 코드</strong>로만 돌아올 수 있어요. 복구 코드는 다른 사람에게 알려주지 마세요.</li>
          <li>초대 링크를 가진 사람은 누구나 합류할 수 있어요. 링크가 잘못 퍼졌다면 팀장이 새 링크를 만들 수 있어요.</li>
        </ul>
      </section>
      <section>
        <h2>3. 올리면 안 되는 것</h2>
        <ul>
          <li>비밀번호, API 키, 개인정보(주민등록번호, 연락처 등)가 들어간 코드</li>
          <li>남의 저작물을 허락 없이 올리는 것, 악성코드, 불법·혐오·괴롭힘 내용</li>
          <li>자동화 도구로 요청을 쏟아내는 등 서비스를 방해하는 행위</li>
        </ul>
        <p className="mt-1.5">이런 내용이 확인되면 알림 없이 지우거나 이용을 막을 수 있어요.</p>
      </section>
      <section>
        <h2>4. AI 분석</h2>
        <p>
          AI 요약·경고·개념 설명은 참고용이에요. 틀릴 수 있으니 최종 판단은 팀원이 함께 해주세요. AI 분석을 위해 바뀐 부분(diff)이 외부 AI 제공자에게 전달돼요.
          자세한 내용은 개인정보 처리방침을 확인해주세요.
        </p>
      </section>
      <section>
        <h2>5. 데이터 보관과 삭제</h2>
        <ul>
          <li>마지막 활동 후 {EXPIRE_DAYS}일 동안 아무도 쓰지 않은 프로젝트는 자동으로 정리돼요. 30일 전부터 화면에 알려줘요.</li>
          <li>팀장은 언제든 프로젝트를 지울 수 있고, 지우면 되살릴 수 없어요. 그 전에 원본 코드를 내려받을 수 있어요.</li>
          <li>무료 학습용 서비스라 데이터 백업을 보장하지 않아요. 중요한 코드는 따로 보관해주세요.</li>
        </ul>
      </section>
      <section>
        <h2>6. 책임의 한계</h2>
        <p>
          서비스는 있는 그대로 제공돼요. 점검·장애로 잠시 멈출 수 있고, 서비스 이용이나 AI 답변 때문에 생긴 손해에 대해서는 법이 허용하는 범위에서 책임지지 않아요.
          약관을 바꿀 때는 시행 7일 전에 이 화면에 알려요.
        </p>
      </section>
      <section>
        <h2>7. 문의</h2>
        <p>
          운영: {name} · {email ? <a className="underline" href={`mailto:${email}`}>{email}</a> : "문의처 준비 중"}
        </p>
      </section>
    </LegalPage>
  );
}
