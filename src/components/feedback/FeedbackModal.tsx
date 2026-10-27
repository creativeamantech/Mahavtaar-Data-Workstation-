import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { submitCustomerFeedback } from '../../lib/repositories/feedbackRepository';
import { 
  AVAILABILITY_OPTIONS, 
  AvailabilityOption, 
  StandardFeedback, 
  getValidFeedbacksForAvailability, 
  isValidFeedbackForAvailability,
  FeedbackFormData,
  INITIAL_FEEDBACK_STATE
} from '../../constants/feedbackConfig';
import { CustomerFeedback } from '../../lib/db';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { CheckCircle2, PhoneCall, Layers, FileText, X } from 'lucide-react';
import { toast } from 'sonner';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  agreementId: string;
  customerName?: string;
  contactNumber: string;
  phoneSource?: string;
  phoneLabel?: string;
  onSubmitSuccess?: (feedback: CustomerFeedback) => void;
}

export function FeedbackModal({
  isOpen,
  onClose,
  agreementId,
  customerName,
  contactNumber,
  phoneSource,
  phoneLabel,
  onSubmitSuccess,
}: FeedbackModalProps) {
  const { user } = useAuth();
  const [formData, setFormData] = useState<FeedbackFormData>(INITIAL_FEEDBACK_STATE);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form whenever modal opens with a new number
  React.useEffect(() => {
    if (isOpen) {
      setFormData(INITIAL_FEEDBACK_STATE);
    }
  }, [isOpen, contactNumber]);

  /**
   * Availability change with automatic validity check for standard feedback
   */
  const handleAvailabilityChange = (newAvailability: AvailabilityOption) => {
    setFormData(prev => {
      if (prev.availability === newAvailability) return prev;

      const isCurrentFeedbackStillValid = isValidFeedbackForAvailability(
        newAvailability,
        prev.standardFeedback
      );

      return {
        ...prev,
        availability: newAvailability,
        standardFeedback: isCurrentFeedbackStillValid ? prev.standardFeedback : '',
        detailedFeedback: isCurrentFeedbackStillValid ? prev.detailedFeedback : '',
      };
    });
  };

  const handleStandardFeedbackChange = (feedback: StandardFeedback) => {
    setFormData(prev => ({
      ...prev,
      standardFeedback: feedback,
    }));
  };

  const handleDetailedFeedbackChange = (text: string) => {
    setFormData(prev => ({
      ...prev,
      detailedFeedback: text,
    }));
  };

  const validFeedbacks = getValidFeedbacksForAvailability(formData.availability);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!contactNumber.trim()) {
      toast.error('No contact number detected.');
      return;
    }

    if (!formData.availability) {
      toast.error('Please select Customer Availability.');
      return;
    }

    if (!formData.standardFeedback) {
      toast.error('Please select Standard Feedback.');
      return;
    }

    setIsSubmitting(true);

    try {
      const feedbackPayload: CustomerFeedback = {
        id: crypto.randomUUID(),
        agreementid: agreementId,
        contactNumber: contactNumber.trim(),
        availability: formData.availability,
        status: formData.standardFeedback,
        standardFeedback: formData.standardFeedback,
        detailedFeedback: formData.detailedFeedback.trim(),
        agentId: user?.id || 'unknown',
        agentName: user?.name || 'Unknown Agent',
        createdAt: new Date().toISOString(),
      };

      await submitCustomerFeedback(feedbackPayload, {
        actorUserId: user?.id,
        actorName: user?.name || 'Unknown Agent',
        actorRole: user?.role || 'EXECUTIVE',
      });

      toast.success(`Feedback recorded for ${contactNumber}`);
      setFormData(INITIAL_FEEDBACK_STATE);
      onClose();

      if (onSubmitSuccess) {
        onSubmitSuccess(feedbackPayload);
      }
    } catch (err) {
      console.error('Failed to submit feedback:', err);
      toast.error('Failed to record feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-lg p-0 overflow-hidden border-border bg-card">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-border bg-primary/10">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
                <PhoneCall className="h-4 w-4 text-primary" />
                Log Interaction Feedback
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>Customer: <strong className="text-foreground">{customerName || 'N/A'}</strong></span>
              <span>•</span>
              <span>Agreement: <strong className="font-mono text-foreground">{agreementId}</strong></span>
            </DialogDescription>
          </DialogHeader>

          {/* Auto-detected Phone Banner */}
          <div className="mt-3 bg-background border border-border/80 rounded-lg px-3 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-bold text-muted-foreground uppercase">Target Number:</span>
              <span className="font-mono font-extrabold text-sm text-foreground">{contactNumber}</span>
            </div>
            {(phoneLabel || phoneSource) && (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                {phoneLabel ? `${phoneLabel} (${phoneSource})` : phoneSource?.replace(/_/g, ' ')}
              </span>
            )}
          </div>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4">
          {/* Step 1: Availability */}
          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-primary" />
              1. Availability <span className="text-destructive">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Customer Availability">
              {AVAILABILITY_OPTIONS.map(opt => {
                const isSelected = formData.availability === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => handleAvailabilityChange(opt)}
                    className={`py-2 px-3 text-xs font-bold rounded-lg border transition-all duration-150 active:scale-95 text-center ${
                      isSelected
                        ? 'bg-primary text-primary-foreground border-primary shadow-xs font-extrabold ring-1 ring-primary/40'
                        : 'bg-card text-muted-foreground border-border hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Step 2: Standard Feedbacks */}
          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">
              2. Standard Feedbacks <span className="text-destructive">*</span>
            </label>
            {!formData.availability ? (
              <div className="h-9 rounded-md border border-dashed border-border bg-muted/30 px-3 flex items-center text-xs text-muted-foreground italic">
                Select Availability first to view valid Standard Feedbacks
              </div>
            ) : (
              <select
                value={formData.standardFeedback}
                onChange={e => handleStandardFeedbackChange(e.target.value as StandardFeedback)}
                className="w-full h-9 rounded-md border border-border bg-background px-3 text-xs sm:text-sm font-sans focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary cursor-pointer"
                required
                autoFocus
              >
                <option value="">Select Standard Feedback ({validFeedbacks.length} options)...</option>
                {validFeedbacks.map(fb => (
                  <option key={fb} value={fb}>
                    {fb}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Step 3: Detailed Feedback (Free Text) */}
          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                3. Detailed Feedback <span className="text-[11px] font-normal text-muted-foreground">(Free text)</span>
              </span>
              <span className="text-[10px] text-muted-foreground font-normal">Optional</span>
            </label>
            <textarea
              value={formData.detailedFeedback}
              onChange={e => handleDetailedFeedbackChange(e.target.value)}
              placeholder="Enter specific notes, customer remarks, or conversation summary..."
              rows={3}
              className="w-full rounded-md border border-border bg-background p-2.5 text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary resize-none placeholder:text-muted-foreground/60"
            />
          </div>

          {/* Form Actions */}
          <div className="pt-3 border-t border-border flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 h-9 rounded-lg border border-border bg-card text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !formData.availability || !formData.standardFeedback}
              className="px-5 h-9 rounded-lg bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/90 transition-all flex items-center gap-1.5 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed active:scale-98"
            >
              <CheckCircle2 className="h-4 w-4" />
              {isSubmitting ? 'Saving...' : 'Save Feedback'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
