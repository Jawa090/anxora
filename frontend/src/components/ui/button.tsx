import * as React from "react"
import { cn } from "@/lib/utils"

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
  size?: 'default' | 'sm' | 'lg' | 'icon'
}

const buttonVariants = (options: { variant?: string; size?: string } = {}) => {
  const variant = options.variant || 'default';
  const size = options.size || 'default';
  
  let classes = "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-bold cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0";
  
  if (variant === 'default') classes += " bg-[#7D5CE4] text-white shadow-md shadow-[#7D5CE4]/20 hover:bg-[#7D5CE4]/80";
  else if (variant === 'destructive') classes += " bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90";
  else if (variant === 'outline') classes += " border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground";
  else if (variant === 'secondary') classes += " bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80";
  else if (variant === 'ghost') classes += " hover:bg-accent hover:text-accent-foreground";
  else if (variant === 'link') classes += " text-primary underline-offset-4 hover:underline";
  
  if (size === 'sm') classes += " h-8 rounded-md px-3 text-xs";
  else if (size === 'lg') classes += " h-10 rounded-md px-8";
  else if (size === 'icon') classes += " h-9 w-9";
  else classes += " h-9 px-4 py-2";
  
  return classes;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
