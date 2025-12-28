import { BottomNavItem } from '../BottomNav/BottomNavItem';
import './BottomNav.css';

interface NavItem {
  id: number;
  label: string;
  icon: string;
  onClick: () => void;
}

interface BottomNavProps {
  items: NavItem[];
}

export function BottomNav({ items }: BottomNavProps) {
  return (
    <nav className="bottom-nav">
      {items.map(item => (
        <BottomNavItem key={item.id} {...item} />
      ))}
    </nav>
  );
}
