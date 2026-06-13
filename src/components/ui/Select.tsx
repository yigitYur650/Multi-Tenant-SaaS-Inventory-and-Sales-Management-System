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
  icon?: React.ReactNode;
}

export function Select({ value, onValueChange, items, placeholder = 'Select', className, icon }: SelectProps) {
  return (
    <SelectPrimitive.Root value={value} onValueChange={onValueChange}>
      <SelectPrimitive.Trigger
        className={cn(
          'flex items-center justify-between gap-2 px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary',
          className
        )}
      >
        <div className="flex items-center gap-2">
          {icon}
          <SelectPrimitive.Value placeholder={placeholder} />
        </div>
        <SelectPrimitive.Icon>
          <ChevronDownIcon className="w-4 h-4 opacity-50" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          className="bg-slate-900 border border-white/20 rounded-2xl shadow-2xl max-h-60 overflow-y-auto p-1.5 z-[9999]"
          onPointerDownOutside={(e) => {
            const isJsdom = typeof window !== 'undefined' && window.navigator && window.navigator.userAgent && window.navigator.userAgent.includes('jsdom');
            if (isJsdom) {
              e.preventDefault();
            }
          }}
        >
          <SelectPrimitive.Viewport className="p-1">
            {items.map((item) => (
              <SelectPrimitive.Item
                key={item.value}
                value={item.value}
                className={cn(
                  'flex items-center justify-between px-3 py-2 rounded-xl text-sm cursor-pointer text-slate-100 font-bold hover:bg-white/10 hover:text-white focus:bg-white/10 focus:text-white focus:outline-none transition-all duration-200 select-none',
                  'data-[state=checked]:bg-white/15 data-[state=checked]:text-white'
                )}
              >
                <SelectPrimitive.ItemText>{item.label}</SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator>
                  <CheckIcon className="w-4 h-4 text-white" />
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
