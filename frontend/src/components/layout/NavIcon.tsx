import {
  Basket,
  Buildings,
  CalendarBlank,
  ChartBarHorizontal,
  ChartLineUp,
  ClipboardText,
  Clock,
  FolderSimple,
  Invoice,
  SignOut,
  SlidersHorizontal,
  SquaresFour,
  UsersThree,
  type Icon,
} from '@phosphor-icons/react';
import type { NavigationIcon } from './navigation';

const ICONS: Record<NavigationIcon, Icon> = {
  dashboard: SquaresFour,
  timeline: ChartBarHorizontal,
  time: Clock,
  projects: FolderSimple,
  planning: CalendarBlank,
  tasks: ClipboardText,
  people: UsersThree,
  settings: SlidersHorizontal,
  kpi: ChartLineUp,
  basket: Basket,
  tm: Invoice,
  business: Buildings,
  logout: SignOut,
};

export default function NavIcon({ name, className = 'size-5' }: { name: NavigationIcon; className?: string }) {
  const Glyph = ICONS[name];
  return <Glyph aria-hidden="true" className={className} />;
}
