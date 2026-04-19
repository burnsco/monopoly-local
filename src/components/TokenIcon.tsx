interface TokenIconProps {
  name: string;
  size?: number;
  className?: string;
}

const NAME_TO_EMOJI: Record<string, string> = {
  car: "🚗",
  dog: "🐕",
  rocket: "🚀",
  tophat: "🎩",
  "top hat": "🎩",
  hat: "🎩",
  unicorn: "🦄",
  turtle: "🐢",
  ufo: "🛸",
  octopus: "🐙",
  ship: "🚢",
  boot: "🥾",
  thimble: "🪡",
  iron: "🧺",
  wheelbarrow: "🛒",
  cat: "🐈",
  horse: "🐎",
  anchor: "⚓",
  bird: "🐦",
  carfrog: "🐸",
  frog: "🐸",
};

function resolveEmoji(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "❓";
  const first = Array.from(trimmed)[0] ?? "";
  const code = first.codePointAt(0) ?? 0;
  if (code > 0x1f000 || code === 0x26d4 || code === 0x2693) {
    return trimmed;
  }
  const mapped = NAME_TO_EMOJI[trimmed.toLowerCase()];
  if (mapped) return mapped;
  return trimmed.slice(0, 2).toUpperCase();
}

export function TokenIcon({ name, size = 20, className }: TokenIconProps) {
  const display = resolveEmoji(name);
  return (
    <span
      className={className ?? "token-emoji"}
      role="img"
      aria-label={`Player token ${name}`}
      style={{ fontSize: `${size}px`, lineHeight: 1 }}
    >
      {display}
    </span>
  );
}
