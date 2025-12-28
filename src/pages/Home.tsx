import { useNavigate } from 'react-router-dom';
import { BottomNav } from "../components/BottomNav/BottomNav";
import { Header } from "../components/Header/Header";
import { GameModeCard } from "../components/GameCard/GameModeCard";
import { ActiveGameCard } from "../components/ActiveGameCard/ActiveGameCard";
import { useTelegramUser } from "../hooks/useTelegramUser";
import './Home.css';
import "../components/GameCard/GameCard.css"
import "../components/GameCard/GameModeCard.css"

export function Home() {
  const { username } = useTelegramUser();
  const navigate = useNavigate();

  const gameModes = [
    {
      id: 1,
      icon: "👥",
      title: "Play with friend",
      subtitle: "Challenge someone you know",
      onClick: () => navigate('/play-with-friend')
    },
    {
      id: 2,
      icon: "🤖",
      title: "Play with Bot",
      subtitle: "Challenge AI opponent",
      onClick: () => navigate('/play-with-bot')
    }
  ];

  const activeGames = [
    { id: 1, opponent: "John", status: "Your turn", time: "2m ago" },
    { id: 2, opponent: "Bot (Medium)", status: "Bot thinking...", time: "5m ago" },
    { id: 3, opponent: "Alice", status: "Waiting...", time: "10m ago" }
  ];

  const navItems = [
    {
      id: 1,
      label: "Home",
      icon: "🏠",
      onClick: () => navigate('/')
    },
    {
      id: 2,
      label: "Games",
      icon: "♟️",
      onClick: () => console.log("Games")
    },
    { 
      id: 3,
      label: "Profile",
      icon: "👤",
      onClick: () => console.log("Profile")
    }
  ];

  return (
    <div className="home">
      <Header 
        title="Start New Game"
        subtitle="Choose your mode"
        onBack={() => window.history.back()}
      />

      <main className="home-content">
        <section className="game-modes-section">
          <h2 className="section-title">Game Modes</h2>
          <div className="game-modes-grid">
            {gameModes.map(mode => (
              <GameModeCard key={mode.id} {...mode} />
            ))}
          </div>
        </section>

        <div className="divider"></div>

        <section className="active-games-section">
          <h2 className="section-title">Active Games</h2>
          <div className="active-games-list">
            {activeGames.map(game => (
              <ActiveGameCard key={game.id} {...game} />
            ))}
          </div>
        </section>
      </main>

      <BottomNav items={navItems} />
    </div>
  );
}