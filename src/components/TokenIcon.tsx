import {
  Anchor,
  Bird,
  CarFront,
  Crown,
  Ghost,
  Ship,
  Skull,
  Trophy,
} from 'lucide-react'
import type { LucideIcon, LucideProps } from 'lucide-react'

interface TokenIconProps extends LucideProps {
  name: string
}

const TOKEN_ICONS: Record<string, LucideIcon> = {
  Anchor,
  Bird,
  CarFront,
  Crown,
  Ghost,
  Ship,
  Skull,
  Trophy,
}

export function TokenIcon({ name, ...props }: TokenIconProps) {
  const Icon = TOKEN_ICONS[name]
  if (!Icon) return <span>{name.slice(0, 1)}</span>
  return <Icon {...props} />
}
