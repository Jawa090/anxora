import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/components/theme-provider';
import { cn } from '@/lib/utils';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const toggleTheme = () => {
    if (theme === 'light' || theme === 'system') {
      setTheme('dark');
    } else {
      setTheme('light');
    }
  };

  const isDark = theme === 'dark';

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleTheme}
      className={cn(
        "gap-2 px-2.5 py-2 h-10 w-10 flex items-center justify-center active:scale-95 transition-all duration-200",
        !isDark ? "text-black hover:text-white hover:bg-primary" : "text-primary hover:text-primary hover:bg-gray-800/100 border border-transparent hover:border-border"
      )}
      title={`Current: ${isDark ? 'Dark' : 'Light'} - Click to switch themes`}
    >
      <div className="transition-transform duration-300 hover:rotate-12">
        {isDark ? (
          <Moon className="h-5 w-5" />
        ) : (
          <Sun className="h-5 w-5" />
        )}
      </div>
    </Button>
  );
}
