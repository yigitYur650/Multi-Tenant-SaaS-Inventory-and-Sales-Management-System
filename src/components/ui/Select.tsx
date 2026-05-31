import * as React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { CheckIcon, ChevronDownIcon } from 'lucide-react';

interface SelectItem {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  onValueChange: (value: string) => void;
  items: SelectItem[];
  placeholder?: string;
  className?: string;
}

export function Select({ value, onValueChange, items, placeholder = 'Select', className }: SelectProps) {
  return (
    <SelectPrimitive.Root value={value} onValueChange={onValueChange}>
      <SelectPrimitive.Trigger
        className={cn(
          'flex items-center justify-between gap-2 px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary',
          className
        )}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon>
          <ChevronDownIcon className="w-4 h-4 opacity-50" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content className="bg-white dark:bg-slate-800 rounded-md shadow-md max-h-60 overflow-y-auto">
          <SelectPrimitive.Viewport className="p-1">
            {items.map((item) => (
              <SelectPrimitive.Item
                key={item.value}
                value={item.value}
                className={cn(
                  'flex items-center justify-between px-2 py-1.5 rounded-sm text-sm cursor-pointer focus:bg-primary/10 focus:outline-none',
                  'data-[state=checked]:bg-primary/10 data-[state=checked]:font-medium'
                )}
              >
                <SelectPrimitive.ItemText>{item.label}</SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator>
                  <CheckIcon className="w-4 h-4" />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

// Helper to combine class names (you might already have this in your utils)
function cn(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
