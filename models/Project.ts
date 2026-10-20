import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

// 멤버는 서브문서라 _id가 자동 생성된다. 이 _id를 쿠키에 저장해 "나"를 식별한다.
const memberSchema = new Schema(
  {
    nickname: { type: String, required: true, trim: true, maxlength: 20 },
    role: { type: String, enum: ["LEADER", "MEMBER"], required: true },
    // 복구 코드의 해시 (원문은 저장하지 않는다). 예전 멤버는 없을 수 있다
    recoveryHash: { type: String },
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
  lastActivityAt: { type: Date, default: Date.now }, // 마지막 활동(제출·병합·댓글). 오래 안 쓰면 정리 대상이 된다
});

// 복구 코드로 멤버를 찾는 조회용 (값이 없는 멤버는 인덱스에서 뺀다)
projectSchema.index({ lastActivityAt: 1 }); // 정리 대상 조회용
projectSchema.index({ "members.recoveryHash": 1 }, { sparse: true });

export type ProjectDoc = InferSchemaType<typeof projectSchema>;

// 핫리로드 시 모델이 중복 등록되는 것을 방지
export const Project: Model<ProjectDoc> =
  (models.Project as Model<ProjectDoc>) ?? model<ProjectDoc>("Project", projectSchema);
