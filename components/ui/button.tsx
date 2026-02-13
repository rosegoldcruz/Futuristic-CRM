import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyber-cyan disabled:pointer-events-none disabled:opacity-50 uppercase tracking-wider font-display",
  {
    variants: {
      variant: {
        default: "bg-cyber-cyan text-bgDarkest shadow-cyberSm hover:shadow-cyberMd hover:bg-cyber-cyanDim",
        destructive: "bg-cyber-red text-white shadow-sm hover:bg-cyber-red/80 border border-cyber-red",
        outline: "border border-cyber-cyan bg-transparent text-cyber-cyan hover:bg-cyber-cyan hover:text-bgDarkest hover:shadow-cyberMd",
        secondary: "border border-borderSubtle bg-surface text-textPrimary hover:border-cyber-cyan hover:text-cyber-cyan",
        ghost: "hover:bg-surface hover:text-cyber-cyan",
        link: "text-cyber-cyan underline-offset-4 hover:underline",
        magenta: "border border-cyber-magenta bg-transparent text-cyber-magenta hover:bg-cyber-magenta hover:text-bgDarkest hover:shadow-cyberMagenta",
        yellow: "border border-cyber-yellow bg-transparent text-cyber-yellow hover:bg-cyber-yellow hover:text-bgDarkest hover:shadow-cyberYellow",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-10 px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
