import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

// 수업(반): 강사가 만들고, 팀장이 반 코드로 자기 프로젝트를 연결한다.
// 강사는 로그인 대신 "강사용 비밀 링크"로 들어온다. DB에는 그 링크 토큰의 해시만 저장한다
const classroomSchema = new Schema({
  title: { type: String, required: true, trim: true, maxlength: 50 },
  instructorName: { type: String, default: "", trim: true, maxlength: 20 },
  ownerTokenHash: { type: String, required: true, unique: true }, // 강사용 링크 토큰의 SHA-256
  joinCode: { type: String, required: true, unique: true }, // 학생(팀장)에게 알려주는 반 코드. 예) K7P2-XQ9M
  // 강사가 설정하는 과제 목표 안내와 시작 코드(빈 프로젝트가 처음 수업에 연결될 때 자동으로 채워진다)
  assignmentPrompt: { type: String, default: "", trim: true, maxlength: 500 },
  starterCode: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now },
  lastActivityAt: { type: Date, default: Date.now, index: true }, // 강사가 마지막으로 본 시각 (오래 안 쓰면 정리)
});

export type ClassroomDoc = InferSchemaType<typeof classroomSchema>;

export const Classroom: Model<ClassroomDoc> =
  (models.Classroom as Model<ClassroomDoc>) ?? model<ClassroomDoc>("Classroom", classroomSchema);
