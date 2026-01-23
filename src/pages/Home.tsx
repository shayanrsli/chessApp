import { BottomNav } from "../components/BottomNav/BottomNav";
import { Header } from "../components/Header/Header";
import { GameModeCard } from "../components/GameCard/GameModeCard";
import { ActiveGameCard } from "../components/ActiveGameCard/ActiveGameCard";
import { useTelegramUser } from "../hooks/useTelegramUser";
import './Home.css';
import "../components/GameCard/GameCard.css"
import "../components/GameCard/GameModeCard.css"

type AppView = 'home' | 'playWithFriend' | 'playWithBot';

interface HomeProps {
  onNavigate: (view: AppView) => void;
}

interface GameMode {
  id: number;
  icon: string;
  title: string;
  subtitle: string;
  onClick: () => void;
}

interface ActiveGame {
  id: number;
  opponent: string;
  status: string;
  time: string;
}

interface NavItem {
  id: number;
  label: string;
  icon: string;
  onClick: () => void;
}

export function Home({ onNavigate }: HomeProps) {
  const { username } = useTelegramUser();

  const gameModes: GameMode[] = [
    {
      id: 1,
      icon: "👥",
      title: "بازی با دوست",
      subtitle: "با دوستان خود بازی کنید",
      onClick: () => onNavigate('playWithFriend') // تغییر اینجا
    },
    {
      id: 2,
      icon: "🤖",
      title: "بازی با ربات",
      subtitle: "حریف هوش مصنوعی",
      onClick: () => onNavigate('playWithBot')
    }
  ];

  const activeGames: ActiveGame[] = [
    { id: 1, opponent: "جان", status: "نوبت شما", time: "۲ دقیقه پیش" },
    { id: 2, opponent: "ربات (متوسط)", status: "ربات در حال فکر...", time: "۵ دقیقه پیش" },
    { id: 3, opponent: "آلیس", status: "در انتظار...", time: "۱۰ دقیقه پیش" }
  ];

  const navItems: NavItem[] = [
    {
      id: 1,
      label: "خانه",
      icon: "🏠",
      onClick: () => onNavigate('home')
    },
    {
      id: 2,
      label: "بازی‌ها",
      icon: "♟️",
      onClick: () => {
        alert("صفحه بازی‌ها به زودی اضافه خواهد شد!");
      }
    },
    { 
      id: 3,
      label: "پروفایل",
      icon: "👤",
      onClick: () => {
        alert("صفحه پروفایل به زودی اضافه خواهد شد!");
      }
    }
  ];

  return (
    <div className="home" dir="rtl">
      <Header 
        title="شروع بازی جدید"
        subtitle="حالت بازی را انتخاب کنید"
        onBack={() => window.history.back()}
      />

      <main className="home-content">
        <section className="game-modes-section">
          <h2 className="section-title">حالت‌های بازی</h2>
          <div className="game-modes-grid">
            {gameModes.map(mode => (
              <GameModeCard key={mode.id} {...mode} />
            ))}
          </div>
        </section>

        <div className="divider"></div>

        <section className="active-games-section">
          <h2 className="section-title">بازی‌های فعال</h2>
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