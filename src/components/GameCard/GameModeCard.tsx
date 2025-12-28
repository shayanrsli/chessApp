import './GameModeCard.css';

interface GameModeCardProps {
  icon: string;
  title: string;
  subtitle: string;
  onClick: () => void;
}

export function GameModeCard({ icon, title, subtitle, onClick }: GameModeCardProps) {
  return (
    <div className="game-mode-card" onClick={onClick}>
      <div className="game-mode-icon">{icon}</div>
      <div className="game-mode-content">
        <h3 className="game-mode-title">{title}</h3>
        <p className="game-mode-subtitle">{subtitle}</p>
      </div>
    </div>
  );
}