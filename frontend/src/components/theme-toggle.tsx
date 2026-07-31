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
        "gap-2 px-3 py-2 h-9 transition-all duration-200 hover:scale-105",
        "border border-transparent hover:border-border",
        "hover:bg-muted/50 active:scale-95"
      )}
      title={`Current: ${isDark ? 'Dark' : 'Light'} - Click to switch themes`}
    >
      <div className="transition-transform duration-300 hover:rotate-12">
        {isDark ? (
          <Moon className="h-5 w-5 text-blue-400" />
        ) : (
          <Sun className="h-5 w-5 text-yellow-500" />
        )}
      </div>
      <span className="text-xs font-medium text-muted-foreground hidden sm:block">
        {isDark ? 'Dark' : 'Light'}
      </span>
    </Button>
  );
}
