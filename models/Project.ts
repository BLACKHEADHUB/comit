import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

// 멤버는 서브문서라 _id가 자동 생성된다. 이 _id를 쿠키에 저장해 "나"를 식별한다.
const memberSchema = new Schema(
  {
    nickname: { type: String, required: true, trim: true, maxlength: 20 },
    role: { type: String, enum: ["LEADER", "MEMBER"], required: true },
  },
  { _id: true }
);

const projectSchema = new Schema({
  title: { type: String, required: true, trim: true, maxlength: 50 },
  description: { type: String, default: "", trim: true, maxlength: 200 },
  members: { type: [memberSchema], default: [] },
  mainCode: { type: String, default: "" },
  // 초대 링크용 추측 불가능한 토큰 (조회가 잦으므로 unique 인덱스)
  inviteToken: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now },
});

export type ProjectDoc = InferSchemaType<typeof projectSchema>;

// 핫리로드 시 모델이 중복 등록되는 것을 방지
export const Project: Model<ProjectDoc> =
  (models.Project as Model<ProjectDoc>) ?? model<ProjectDoc>("Project", projectSchema);
