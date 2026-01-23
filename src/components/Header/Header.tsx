import './Header.css';

interface HeaderProps {
  title: string;
  subtitle: string;
  onBack: () => void;
}

export function Header({ title, subtitle }: HeaderProps) {
  return (
    <header className="header">
      <div className="header-top">
        {/* <button className="back-button" onClick={onBack}>
          <span className="back-arrow">←</span>
          <span>Back</span>
        </button> */}
      </div>
      <div className="header-content">
        <h1 className="header-title">{title}</h1>
        <p className="header-subtitle">{subtitle}</p>
      </div>
    </header>
  );
}