import { useRef, useState } from 'react';
import { CheckCircle2, Circle, UploadCloud, Loader2 } from 'lucide-react';

interface Step {
  id: string;
  title: string;
  optional?: boolean;
  onFileSelect: (file: File) => void;
  status: 'pending' | 'uploading' | 'done' | 'error';
  lastUpload?: string | null;
}

export function UploadStepper({ steps }: { steps: Step[] }) {
  const [activeStep, setActiveStep] = useState<string>(steps[0].id);

  return (
    <div className="mb-6 bg-card border rounded-xl shadow-sm p-4 sm:p-6 shadow-sm">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:flex lg:flex-row w-full items-stretch lg:items-start gap-3 sm:gap-4">
        {steps.map((step, index) => {
          const isActive = activeStep === step.id;
          const isDone = step.status === 'done';
          const isUploading = step.status === 'uploading';
          
          return (
            <div 
              key={step.id} 
              className={`flex-1 relative transition-all duration-300 ${isActive ? 'lg:scale-[1.02]' : 'opacity-70 hover:opacity-100'}`}
              onClick={() => setActiveStep(step.id)}
            >
              {/* Connector Line */}
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute left-[50%] right-[-50%] top-4 h-[1px] bg-border -z-10" />
              )}
              
              <div className={`cursor-pointer rounded-xl border ${isActive ? 'border-primary/50 bg-primary/5 shadow-[0_0_20px_rgba(245,158,11,0.05)]' : 'border-border bg-card/50'} p-3 sm:p-5 flex flex-col ${isActive ? 'items-center text-center' : 'lg:items-center lg:text-center flex-row items-center gap-3'} h-full backdrop-blur-md`}>
                <div className={`flex shrink-0 h-8 w-8 items-center justify-center rounded-full border ${isDone ? 'border-success bg-success/10 text-success' : isUploading ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'} ${isActive ? 'mb-2' : ''}`}>
                  {isDone ? <CheckCircle2 className="h-4 w-4" /> : isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <span className="font-sans text-xs font-bold">{index + 1}</span>}
                </div>
                
                <h4 className={`font-sans text-xs font-bold tracking-wider uppercase mb-1 ${isActive ? 'text-primary' : 'text-foreground'}`}>
                  {step.title}
                </h4>
                
                <span className="font-sans text-[10px] text-muted-foreground mb-3">
                  {step.optional ? '(Optional)' : '(Required)'}
                </span>

                {isActive && (
                  <div className="w-full mt-2 lg:mt-0">
                    <FileDropzone onFileSelect={step.onFileSelect} disabled={isUploading} />
                  </div>
                )}
                
                {!isActive && step.lastUpload && (
                  <div className="font-sans text-[10px] text-success flex items-center gap-1 mt-2 lg:mt-2">
                    <CheckCircle2 className="h-3 w-3 shrink-0" /> <span className="truncate max-w-[120px]">{step.lastUpload}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FileDropzone({ onFileSelect, disabled }: { onFileSelect: (f: File) => void, disabled: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <div
      onClick={() => !disabled && inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (disabled) return;
        const file = e.dataTransfer.files[0];
        if (file) onFileSelect(file);
      }}
      className={`w-full rounded-md border border-dashed p-3 flex flex-col items-center justify-center transition-colors ${dragging ? 'border-primary bg-primary/10' : 'border-[rgba(255,255,255,0.15)] hover:border-primary/50'} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <input 
        ref={inputRef} 
        type="file" 
        accept=".xlsx,.xls,.xlsb,.csv,.XLSB,.XLSX,.XLS,application/vnd.ms-excel.sheet.binary.macroEnabled.12,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,application/octet-stream" 
        className="hidden" 
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFileSelect(file);
          e.target.value = '';
        }} 
      />
      <UploadCloud className="h-5 w-5 text-muted-foreground mb-1" />
      <span className="font-sans text-[10px] text-muted-foreground">Click or Drop File</span>
      <span className="font-sans text-[9px] text-muted-foreground/80 mt-0.5">Excel (.xlsb, .xlsx, .xls) & CSV</span>
    </div>
  );
}
