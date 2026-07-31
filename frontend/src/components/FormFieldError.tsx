import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FormFieldErrorProps {
    error?: string;
    className?: string;
}

export function FormFieldError({ error, className }: FormFieldErrorProps) {
    if (!error) return null;

    return (
        <div className={cn('flex items-center gap-1 mt-1 text-red-600 text-sm', className)}>
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>{error}</span>
        </div>
    );
}

interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    required?: boolean;
    helperText?: string;
}

export const FormInput = ({
    label,
    error,
    required,
    helperText,
    className,
    ...props
}: FormInputProps) => {
    return (
        <div className="w-full">
            {label && (
                <label className="block text-sm font-medium text-foreground mb-1">
                    {label}
                    {required && <span className="text-red-600 ml-1">*</span>}
                </label>
            )}
            <input
                {...props}
                className={cn(
                    'w-full px-3 py-2 border rounded-md bg-background text-foreground',
                    'border-border hover:border-border-hover transition-colors',
                    error && 'border-red-600 bg-red-50 dark:bg-red-950/10',
                    className
                )}
            />
            {error && <FormFieldError error={error} />}
            {helperText && !error && (
                <p className="text-xs text-muted-foreground mt-1">{helperText}</p>
            )}
        </div>
    );
};
