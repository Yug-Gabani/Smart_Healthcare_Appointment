// Implements: FR-03, FR-04, FR-16
// Safety:    S1
// Owner:     frontend (Group 6)

import React from 'react';

interface AdvisoryBannerProps {
  urgency?: string | null;
  summary?: string | null;
  isEmergency?: boolean;
}

export const AIAdvisoryBanner: React.FC<AdvisoryBannerProps> = ({
  urgency,
  summary,
  isEmergency,
}) => {
  if (!urgency && !summary) return null;

  return (
    <div
      className={`p-4 rounded-lg border my-4 ${
        isEmergency || urgency === 'EMERGENCY'
          ? 'bg-red-50 border-red-300 text-red-900'
          : 'bg-blue-50 border-blue-200 text-blue-900'
      }`}
    >
      <div className="flex items-center justify-between pb-1">
        <span className="text-xs font-bold uppercase tracking-wider bg-white/70 px-2 py-0.5 rounded border border-current">
          AI suggestion — for clinician review
        </span>
        {urgency && (
          <span className="font-semibold text-sm">
            Assessed Urgency: {urgency}
          </span>
        )}
      </div>
      {summary && <p className="text-sm mt-2">{summary}</p>}
      <p className="text-xs text-gray-500 mt-2 italic">
        * Non-binding automated assessment. Diagnosis and care decisions are
        exclusively made by licensed medical practitioners.
      </p>
    </div>
  );
};
