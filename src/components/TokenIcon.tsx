interface TokenIconProps {
  name: string;
  size?: number;
  className?: string;
}

export function TokenIcon({ name, size = 20, className }: TokenIconProps) {
  return (
    <span
      className={className ?? "token-emoji"}
      role="img"
      aria-label={`Player token ${name}`}
      style={{ fontSize: `${size}px` }}
    >
      {name}
    </span>
  );
}
