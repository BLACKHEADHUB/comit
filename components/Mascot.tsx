// 마스코트 "코밋이": 커밋 그래프의 점(●)에서 따온 동그란 캐릭터. 직접 그린 인라인 SVG이고, 표정만 바꿔 여러 곳에서 재사용한다.
// 색은 디자인 토큰을 쓰므로 라이트/다크 모드에 자동으로 맞는다. 기본은 장식(aria-hidden)이고, label을 주면 그림으로 읽힌다.

export type MascotMood =
  | "hello" // 손 흔들기 (첫 인사, 온보딩)
  | "happy" // 활짝 웃음 (잘했어요)
  | "calm" // 차분히 기다림 (빈 상태)
  | "oops" // 깜짝 놀람 (404, 오류)
  | "thinking" // 생각 중 (로딩)
  | "cheer"; // 만세 (병합 성공, 완료)

type Props = { mood?: MascotMood; size?: number; className?: string; label?: string };

const BLUSH = "#ffc9b0"; // 볼터치 (몸통 위에 올라가는 색이라 모드와 상관없이 고정)
const INK = "#1e1b4b"; // 눈/입 선 색 (몸통 위에서만 쓰여 모드와 상관없이 잘 보인다)

function Eyes({ mood }: { mood: MascotMood }) {
  // 웃는 눈: ^ ^ 모양
  if (mood === "happy" || mood === "cheer") {
    return (
      <g fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 35 l3.5 -3.5 l3.5 3.5" />
        <path d="M36 35 l3.5 -3.5 l3.5 3.5" />
      </g>
    );
  }
  // 차분한 눈: 살짝 감은 선
  if (mood === "calm") {
    return (
      <g fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round">
        <path d="M21 34 q3.5 2.5 7 0" />
        <path d="M36 34 q3.5 2.5 7 0" />
      </g>
    );
  }
  // 흰자 + 눈동자 (놀라면 크게, 생각 중이면 위쪽을 본다)
  const r = mood === "oops" ? 5 : 4.2;
  const dx = mood === "thinking" ? 1.4 : 0;
  const dy = mood === "thinking" ? -1.6 : 0;
  return (
    <g>
      <circle cx="24.5" cy="33.5" r={r} fill="#fff" />
      <circle cx="39.5" cy="33.5" r={r} fill="#fff" />
      <circle cx={24.5 + dx} cy={33.5 + dy} r="2.1" fill={INK} />
      <circle cx={39.5 + dx} cy={33.5 + dy} r="2.1" fill={INK} />
    </g>
  );
}

function Mouth({ mood }: { mood: MascotMood }) {
  const line = { fill: "none", stroke: INK, strokeWidth: 2.2, strokeLinecap: "round" as const };
  if (mood === "oops") return <ellipse cx="32" cy="44.5" rx="2.6" ry="3.2" fill={INK} />;
  if (mood === "thinking") return <path d="M28.5 44.5 h6" {...line} />;
  if (mood === "calm") return <path d="M28.5 43.5 q3.5 2.5 7 0" {...line} />;
  // 활짝 웃는 입 (happy, cheer)
  if (mood === "happy" || mood === "cheer") return <path d="M26.5 42 q5.5 7.5 11 0 z" fill={INK} stroke={INK} strokeWidth="1.6" strokeLinejoin="round" />;
  return <path d="M27 42.5 q5 5 10 0" {...line} />; // hello: 기본 미소
}

function Arms({ mood }: { mood: MascotMood }) {
  const arm = { fill: "none", stroke: "var(--accent)", strokeWidth: 4, strokeLinecap: "round" as const };
  if (mood === "cheer") {
    return (
      <g {...arm}>
        <path d="M13 31 l-6 -9" />
        <path d="M51 31 l6 -9" />
      </g>
    );
  }
  if (mood === "hello") return <path d="M51.5 33 l7 -8" {...arm} />;
  return null;
}

export default function Mascot({ mood = "hello", size = 64, className = "", label }: Props) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={`shrink-0 ${className}`}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {/* 커밋 그래프의 선: 코밋이는 이 선 위의 "점"이다 */}
      <path d="M32 3 v10 M32 59 v2" stroke="var(--line-strong)" strokeWidth="3" strokeLinecap="round" />
      <Arms mood={mood} />
      {/* 몸통: 바깥 고리(연한 색) + 안쪽 원(포인트 색) = 커밋 점 모양 */}
      <circle cx="32" cy="37" r="23" fill="var(--accent-soft)" />
      <circle cx="32" cy="37" r="19.5" fill="var(--accent)" />
      {/* 볼터치 */}
      <circle cx="19.5" cy="41" r="2.8" fill={BLUSH} opacity="0.7" />
      <circle cx="44.5" cy="41" r="2.8" fill={BLUSH} opacity="0.7" />
      <Eyes mood={mood} />
      <Mouth mood={mood} />
      {/* 생각 중일 때 머리 위의 점 세 개 */}
      {mood === "thinking" && (
        <g fill="var(--accent-ink)">
          <circle cx="48" cy="12" r="1.8" />
          <circle cx="54" cy="8" r="2.3" />
          <circle cx="61" cy="4" r="2.6" />
        </g>
      )}
    </svg>
  );
}
