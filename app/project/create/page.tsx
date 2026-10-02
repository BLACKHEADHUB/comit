import CenteredCard from "@/components/CenteredCard";
import CreateProjectForm from "@/components/CreateProjectForm";

export default function CreateProjectPage() {
  return (
    <CenteredCard title="프로젝트 만들기" description="닉네임을 입력하면 팀장으로 프로젝트가 만들어져요.">
      <CreateProjectForm />
    </CenteredCard>
  );
}
