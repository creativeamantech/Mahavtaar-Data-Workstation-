import React, { useState, useId } from 'react';
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
import { CheckCircle2, MessageSquare, PhoneCall, Layers, FileText } from 'lucide-react';
import { toast } from 'sonner';

interface ConditionalFeedbackFormProps {
  agreementId: string;
  customerName?: string;
  phones?: Array<{ number: string; source: string; name?: string }>;
  selectedContactNumber?: string;
  onContactNumberChange?: (number: string) => void;
  onSubmitSuccess?: (feedback: CustomerFeedback) => void;
  className?: string;
}

export function ConditionalFeedbackForm({
  agreementId,
  customerName,
  phones = [],
  selectedContactNumber = '',
  onContactNumberChange,
  onSubmitSuccess,
  className = '',
}: ConditionalFeedbackFormProps) {
  const { user } = useAuth();
  const formId = useId();

  // Contact Phone selection
  const [contactNumber, setContactNumber] = useState<string>(selectedContactNumber || (phones[0]?.number || ''));

  // Structured Feedback State: Availability, Standard Feedback, Detailed Feedback
  const [formData, setFormData] = useState<FeedbackFormData>(INITIAL_FEEDBACK_STATE);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync prop contact number if updated externally
  React.useEffect(() => {
    if (selectedContactNumber && selectedContactNumber !== contactNumber) {
      setContactNumber(selectedContactNumber);
    }
  }, [selectedContactNumber]);

  const handlePhoneChange = (val: string) => {
    setContactNumber(val);
    if (onContactNumberChange) {
      onContactNumberChange(val);
    }
  };

  /**
   * Main Availability Change Handler
   * Automatically resets standard feedback if not valid under the new availability.
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

  /**
   * Main Standard Feedback Change Handler
   */
  const handleStandardFeedbackChange = (feedback: StandardFeedback) => {
    setFormData(prev => ({
      ...prev,
      standardFeedback: feedback,
    }));
  };

  /**
   * Main Detailed Feedback (Free-Text) Handler
   */
  const handleDetailedFeedbackChange = (text: string) => {
    setFormData(prev => ({
      ...prev,
      detailedFeedback: text,
    }));
  };

  // Valid feedback options based on selected Availability
  const validMainFeedbacks = getValidFeedbacksForAvailability(formData.availability);

  /**
   * Form Submission
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!contactNumber.trim()) {
      toast.error('Please select or provide a Contact Number.');
      return;
    }

    if (!formData.availability) {
      toast.error('Please select customer Availability.');
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

      toast.success('Feedback recorded successfully');

      // Reset form fields
      setFormData(INITIAL_FEEDBACK_STATE);

      if (onSubmitSuccess) {
        onSubmitSuccess(feedbackPayload);
      }
    } catch (err) {
      console.error('Failed to submit customer feedback:', err);
      toast.error('Failed to record feedback. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`bg-card border border-border rounded-xl shadow-sm overflow-hidden ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-border bg-primary/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          <h3 className="font-bold text-sm text-foreground">Log Interaction Feedback</h3>
        </div>
        {customerName && (
          <span className="text-xs text-muted-foreground font-medium truncate max-w-[200px]">
            {customerName}
          </span>
        )}
      </div>

      <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-5" noValidate>
        {/* Contact Phone Selection */}
        <div>
          <label htmlFor={`${formId}-contact-number`} className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <PhoneCall className="h-3.5 w-3.5 text-primary" />
            Contact Number <span className="text-destructive">*</span>
          </label>
          <div className="flex gap-2">
            {phones.length > 0 ? (
              <select
                id={`${formId}-contact-number`}
                value={contactNumber}
                onChange={e => handlePhoneChange(e.target.value)}
                className="w-full h-9 rounded-md border border-border bg-background px-3 text-xs sm:text-sm font-sans focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary cursor-pointer"
                required
              >
                <option value="">Select phone number...</option>
                {phones.map(p => (
                  <option key={`${p.number}-${p.source}`} value={p.number}>
                    {p.number} {p.name ? `— ${p.name}` : ''} ({p.source.replace(/_/g, ' ')})
                  </option>
                ))}
              </select>
            ) : (
              <input
                id={`${formId}-contact-number`}
                type="tel"
                value={contactNumber}
                onChange={e => handlePhoneChange(e.target.value)}
                placeholder="Enter 10-digit phone number"
                className="w-full h-9 rounded-md border border-border bg-background px-3 text-xs sm:text-sm font-sans focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                required
              />
            )}
          </div>
        </div>

        {/* PRIMARY FEEDBACK SECTION: FIELDS 1, 2, 3 */}
        <div className="space-y-4 pt-1 border-t border-border/60">
          <div className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-primary">
            <Layers className="h-3.5 w-3.5" />
            Customer Interaction Feedback
          </div>

          {/* 1. AVAILABILITY */}
          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">
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
                        : 'bg-card text-muted-foreground border-border hover:bg-muted/80 hover:text-foreground'
                    }`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. STANDARD FEEDBACKS (Filtered strictly based on Availability) */}
          <div>
            <label htmlFor={`${formId}-standard-feedback`} className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">
              2. Standard Feedbacks <span className="text-destructive">*</span>
            </label>

            {!formData.availability ? (
              <div className="h-9 rounded-md border border-dashed border-border bg-muted/30 px-3 flex items-center text-xs text-muted-foreground italic">
                Select Availability first to view valid Standard Feedbacks
              </div>
            ) : (
              <select
                id={`${formId}-standard-feedback`}
                value={formData.standardFeedback}
                onChange={e => handleStandardFeedbackChange(e.target.value as StandardFeedback)}
                className="w-full h-9 rounded-md border border-border bg-background px-3 text-xs sm:text-sm font-sans focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary cursor-pointer"
                required
              >
                <option value="">Select Standard Feedback ({validMainFeedbacks.length} options)...</option>
                {validMainFeedbacks.map(fb => (
                  <option key={fb} value={fb}>
                    {fb}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* 3. DETAILED FEEDBACK (FREE TEXT) */}
          <div>
            <label htmlFor={`${formId}-detailed-feedback`} className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                3. Detailed Feedback <span className="text-[11px] font-normal text-muted-foreground">(Free text remarks)</span>
              </span>
              <span className="text-[10px] text-muted-foreground font-normal">Optional</span>
            </label>
            <textarea
              id={`${formId}-detailed-feedback`}
              value={formData.detailedFeedback}
              onChange={e => handleDetailedFeedbackChange(e.target.value)}
              placeholder="Enter detailed conversation remarks, payment details, or specific customer comments..."
              rows={3}
              className="w-full rounded-md border border-border bg-background p-2.5 text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary resize-none placeholder:text-muted-foreground/60"
            />
          </div>
        </div>

        {/* Submit Action Button */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={isSubmitting || !formData.availability || !formData.standardFeedback}
            className="w-full h-10 rounded-lg bg-primary text-primary-foreground font-bold text-xs sm:text-sm hover:bg-primary/90 transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed active:scale-98"
          >
            <CheckCircle2 className="h-4 w-4" />
            {isSubmitting ? 'Saving Feedback...' : 'Save Feedback'}
          </button>
        </div>
      </form>
    </div>
  );
}
