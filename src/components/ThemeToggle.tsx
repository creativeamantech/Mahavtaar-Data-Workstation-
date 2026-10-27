import { Moon, Sun } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="relative p-2 hover:bg-muted rounded-full transition-colors text-muted-foreground flex items-center justify-center overflow-hidden"
      aria-label="Toggle theme"
    >
      <Sun className={`h-5 w-5 transition-transform duration-500 ease-in-out ${theme === "dark" ? 'translate-y-10 opacity-0' : 'translate-y-0 opacity-100'}`} />
      <Moon className={`absolute h-5 w-5 transition-transform duration-500 ease-in-out ${theme === "dark" ? 'translate-y-0 opacity-100' : '-translate-y-10 opacity-0'}`} />
    </button>
  );
}
