import {
  BedDouble,
  BriefcaseBusiness,
  Gamepad2,
  GraduationCap,
  HeartPulse,
  PawPrint,
  Plane,
  ReceiptText,
  ShoppingBag,
  Sparkles,
  TrainFront,
  UtensilsCrossed,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import type { CategoryIconKey } from '../../shared/category-icons';

const iconComponents: Record<CategoryIconKey, LucideIcon> = {
  receipt: ReceiptText,
  food: UtensilsCrossed,
  home: BedDouble,
  utilities: Zap,
  transport: TrainFront,
  travel: Plane,
  shopping: ShoppingBag,
  health: HeartPulse,
  entertainment: Gamepad2,
  experiences: Sparkles,
  work: BriefcaseBusiness,
  education: GraduationCap,
  pets: PawPrint,
};

export function CategoryIcon({ icon, size = 18 }: { icon: CategoryIconKey; size?: number }) {
  const Icon = iconComponents[icon];
  return <Icon size={size} aria-hidden="true" />;
}
