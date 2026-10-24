import CenteredCard from "@/components/CenteredCard";
import CreateClassForm from "@/components/CreateClassForm";

export const metadata = { title: "수업 만들기 · Comit" };

export default function CreateClassPage() {
  return (
    <CenteredCard title="수업 만들기" description="강사·조교용이에요. 반 코드를 학생들에게 알려주면, 각 팀의 기여도를 한 화면에서 볼 수 있어요.">
      <CreateClassForm />
    </CenteredCard>
  );
}
