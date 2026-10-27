/**
 * Authoritative Centralized Configuration for Conditional Feedback System
 * 
 * Fields:
 * 1. Availability (Yes | No | Third Party)
 * 2. Standard Feedbacks (Strictly 19 values filtered by Availability)
 * 3. Detailed Feedback (Free text)
 */

export const AVAILABILITY_OPTIONS = ['Yes', 'No', 'Third Party'] as const;
export type AvailabilityOption = (typeof AVAILABILITY_OPTIONS)[number];

export const ALL_STANDARD_FEEDBACKS = [
  'Paid',
  'RNR',
  'PTP',
  'CB',
  'RTP',
  'Non Contactable',
  'Multiple PTP',
  'Already settled',
  'Disputed Case',
  'Loan Closed',
  'Settlement',
  'Agent issue',
  'Dealer Issue',
  'Sensitive Case',
  'Switch off',
  'Busy',
  'Not in Service',
  'Wrong No.',
  'Not Connected',
] as const;

export type StandardFeedback = (typeof ALL_STANDARD_FEEDBACKS)[number];

/**
 * Authoritative Availability -> Standard Feedbacks Mapping
 * Only valid feedbacks for the selected Availability are returned.
 */
export const AVAILABILITY_FEEDBACK_MAP: Record<AvailabilityOption, readonly StandardFeedback[]> = {
  'Yes': [
    'Paid',
    'PTP',
    'CB',
    'RTP',
    'Multiple PTP',
    'Already settled',
    'Disputed Case',
    'Loan Closed',
    'Settlement',
    'Agent issue',
    'Dealer Issue',
    'Sensitive Case',
  ],
  'No': [
    'RNR',
    'Non Contactable',
    'Switch off',
    'Busy',
    'Not in Service',
    'Wrong No.',
    'Not Connected',
  ],
  'Third Party': [
    'Paid',
    'PTP',
    'CB',
    'RTP',
    'Already settled',
    'Disputed Case',
    'Loan Closed',
    'Settlement',
    'Agent issue',
    'Dealer Issue',
    'Sensitive Case',
    'Wrong No.',
  ],
};

/**
 * Helper to retrieve allowed Standard Feedbacks for a given Availability
 */
export function getValidFeedbacksForAvailability(availability: string | undefined | null): readonly StandardFeedback[] {
  if (!availability || !(availability in AVAILABILITY_FEEDBACK_MAP)) {
    return [];
  }
  return AVAILABILITY_FEEDBACK_MAP[availability as AvailabilityOption];
}

/**
 * Helper to check if a specific feedback is valid under the given availability
 */
export function isValidFeedbackForAvailability(
  availability: string | undefined | null,
  feedback: string | undefined | null
): boolean {
  if (!availability || !feedback) return false;
  const allowed = getValidFeedbacksForAvailability(availability);
  return allowed.includes(feedback as StandardFeedback);
}

/**
 * Structured Feedback Form State
 */
export interface FeedbackFormData {
  availability: AvailabilityOption | '';
  standardFeedback: StandardFeedback | '';
  detailedFeedback: string;
}

export const INITIAL_FEEDBACK_STATE: FeedbackFormData = {
  availability: '',
  standardFeedback: '',
  detailedFeedback: '',
};

