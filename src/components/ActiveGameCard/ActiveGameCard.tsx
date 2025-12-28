import './ActiveGameCard.css';

interface ActiveGameCardProps {
  opponent: string;
  status: string;
  time: string;
}

export function ActiveGameCard({ opponent, status, time }: ActiveGameCardProps) {
  return (
    <div className="active-game-card">
      <div className="game-info">
        <div className="game-icon">♟️</div>
        <div className="game-details">
          <div className="game-opponent">{opponent}</div>
          <div className="game-status">{status}</div>
        </div>
      </div>
      <div className="game-meta">
        <div className="game-time">{time}</div>
        <button className="game-action">▶</button>
      </div>
    </div>
  );
}