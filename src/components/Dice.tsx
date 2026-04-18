import { useRef, useEffect } from "react";
import { gsap } from "gsap";
import "./Dice.css";

const DOT_POSITIONS = Array.from({ length: 9 }, (_, index) => `dot-${index}`);

export function Die({ value, rolling }: { value: number; rolling: boolean }) {
  const dieRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (rolling && dieRef.current) {
      gsap.to(dieRef.current, {
        rotate: 360,
        duration: 0.2,
        repeat: -1,
        ease: "none",
      });
    } else if (dieRef.current) {
      gsap.killTweensOf(dieRef.current);
      gsap.to(dieRef.current, { rotate: 0, duration: 0.3 });
    }
  }, [rolling]);

  const dotIndices = [
    [4], // 1
    [0, 8], // 2
    [0, 4, 8], // 3
    [0, 2, 6, 8], // 4
    [0, 2, 4, 6, 8], // 5
    [0, 2, 3, 5, 6, 8], // 6
  ];

  const activeDots = dotIndices[value - 1] || [];

  return (
    <div ref={dieRef} className="die-face nm-flat">
      <div className="die-dots-grid">
        {DOT_POSITIONS.map((dotKey, index) => (
          <div key={dotKey} className={activeDots.includes(index) ? "die-dot" : ""} />
        ))}
      </div>
    </div>
  );
}

export function DiceDisplay({ values, rolling }: { values: readonly number[]; rolling: boolean }) {
  return (
    <div className="dice-container">
      <Die value={values[0] || 1} rolling={rolling} />
      <Die value={values[1] || 1} rolling={rolling} />
    </div>
  );
}
