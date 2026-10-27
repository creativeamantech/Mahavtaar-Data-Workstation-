import { useState, useEffect } from 'react';
import { toast } from 'sonner';

interface TargetInputProps {
  isAmount?: boolean;
  label?: string;
  value?: number;
  onChange?: (val: number) => void;
  targetKey?: string;
  initialPct?: number;
  onSave?: (key: string, val: number) => void;
}

export function TargetInput({ isAmount, label, value, onChange, targetKey, initialPct, onSave }: TargetInputProps) {
  const effectiveInitial = initialPct !== undefined ? initialPct : (value ?? 0);
  const [val, setVal] = useState(effectiveInitial.toString());

  useEffect(() => {
    setVal(effectiveInitial.toString());
  }, [effectiveInitial]);

  const handleBlur = () => {
    const num = parseFloat(val);
    if (isNaN(num) || num < 0) {
      toast.error(isAmount ? 'Invalid amount' : 'Invalid percentage');
      
      setVal(effectiveInitial.toString());
    } else if (num !== effectiveInitial) {
      if (onSave && targetKey) onSave(targetKey, num);
      if (onChange) onChange(num);
      toast.success('Saved ✓');
    }
  };

  const inputEl = (
    <input
      value={val}
      onChange={e => setVal(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={e => {
        if (e.key === 'Enter') {
          e.currentTarget.blur();
        }
      }}
      className={`h-6 ${isAmount ? 'w-24' : 'w-16'} rounded border border-border bg-input px-2 text-right outline-none focus:border-primary`}
    />
  );

  if (label) {
    return (
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <div className="flex items-center gap-2">
          {inputEl}
          {isAmount ? null : <span className="text-muted-foreground">%</span>}
        </div>
      </div>
    );
  }

  return inputEl;
}
