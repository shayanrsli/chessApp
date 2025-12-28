interface BottomNavItemProps {
  label: string;
  icon: string;
  onClick: () => void;
}

export function BottomNavItem({ label, icon, onClick }: BottomNavItemProps) {
  return (
    <div className="bottom-nav-item" onClick={onClick}>
      <span>{icon}</span>
      <small>{label}</small>
    </div>
  );
}
