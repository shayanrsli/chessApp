import { useEffect, useState } from "react";

const ThemeToggle: React.FC = () => {
  const [isDark, setIsDark] = useState<boolean>(() => {
    // اگر قبلاً تم ذخیره شده، همونو بگیر
    return document.documentElement.getAttribute("data-theme") === "dark";
  });

  useEffect(() => {
    const theme: "dark" | "light" = isDark ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", theme);
  }, [isDark]);

  const toggleTheme = (): void => {
    setIsDark(prev => !prev);
  };

  return (
    <button
      type="button"
      className={`theme-toggle ${isDark ? "dark" : "light"}`}
      onClick={toggleTheme}
      aria-label="Toggle theme"
    >
      {isDark ? "☀️" : "🌙"}
    </button>
  );
};

export default ThemeToggle;
    