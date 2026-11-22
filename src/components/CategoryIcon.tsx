import {
  ArrowLeftRight,
  Briefcase,
  Circle,
  CreditCard,
  Dumbbell,
  Gift,
  Heart,
  Home,
  Laptop,
  Percent,
  Plane,
  Repeat,
  RotateCcw,
  Shield,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Ticket,
  TrainFront,
  TrendingUp,
  UtensilsCrossed,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { getCategory } from '../lib/categories';

export const ICONS: Record<string, LucideIcon> = {
  briefcase: Briefcase,
  laptop: Laptop,
  percent: Percent,
  rotate: RotateCcw,
  home: Home,
  cart: ShoppingCart,
  zap: Zap,
  train: TrainFront,
  heart: Heart,
  shield: Shield,
  utensils: UtensilsCrossed,
  bag: ShoppingBag,
  repeat: Repeat,
  ticket: Ticket,
  dumbbell: Dumbbell,
  plane: Plane,
  sparkles: Sparkles,
  gift: Gift,
  arrows: ArrowLeftRight,
  card: CreditCard,
  trend: TrendingUp,
  circle: Circle,
};

export function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const C = ICONS[name] ?? Circle;
  return <C size={size} strokeWidth={2} aria-hidden="true" />;
}

export function CategoryIcon({ id, size = 36 }: { id: string; size?: number }) {
  const c = getCategory(id);
  return (
    <span
      className="cat-icon"
      style={{ width: size, height: size, background: `color-mix(in srgb, ${c.color} 16%, transparent)`, color: c.color }}
      aria-hidden="true"
    >
      <Icon name={c.icon} size={Math.round(size * 0.47)} />
    </span>
  );
}
