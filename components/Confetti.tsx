// 색종이 효과 (CSS만, 0.9초). 축하할 일이 생겼을 때 부모(relative) 안에서 한 번 터진다.
// 장식이라 화면낭독기에는 읽히지 않고, "움직임 줄이기" 설정에서는 그려지지 않는다 (globals.css)

// 조각마다 날아갈 방향(dx, dy), 회전, 색을 미리 정해 둔다 (렌더링할 때마다 같아야 서버/브라우저 결과가 일치한다)
const COLORS = ["var(--accent)", "var(--mint)", "var(--peach)", "var(--lavender)", "var(--ok)", "var(--warn)"];
const PIECES = Array.from({ length: 16 }, (_, i) => {
  const angle = (i / 16) * Math.PI * 2;
  const distance = 46 + (i % 4) * 14;
  return {
    dx: Math.round(Math.cos(angle) * distance),
    dy: Math.round(Math.sin(angle) * distance * 0.8) - 18, // 살짝 위로 터진다
    rot: (i % 2 === 0 ? 1 : -1) * (120 + i * 25),
    color: COLORS[i % COLORS.length],
    round: i % 3 === 0,
  };
});

export default function Confetti() {
  return (
    <span aria-hidden className="comit-confetti">
      {PIECES.map((p, i) => (
        <i
          key={i}
          style={
            {
              "--dx": `${p.dx}px`,
              "--dy": `${p.dy}px`,
              "--rot": `${p.rot}deg`,
              background: p.color,
              borderRadius: p.round ? "9999px" : "2px",
            } as React.CSSProperties
          }
        />
      ))}
    </span>
  );
}
