import React from 'react';

interface QuickRepliesProps {
  suggestions?: string[];
  onSelect: (text: string) => void;
  disabled?: boolean;
}

export const QuickReplies: React.FC<QuickRepliesProps> = ({
  suggestions,
  onSelect,
  disabled,
}) => {
  if (!suggestions || suggestions.length === 0) return null;

  return (
    <div className="py-2 px-3 flex flex-wrap items-center gap-1.5 border-t border-[#e6f0ed] bg-white">
      {suggestions.map((text, idx) => (
        <button
          key={idx}
          onClick={() => onSelect(text)}
          disabled={disabled}
          className="max-w-full text-[10px] whitespace-normal px-2.5 py-1.5 rounded-full bg-[#f2faf7] text-[#24766e] font-semibold border border-[#d2e9e2] hover:bg-[#e7f5f0] hover:border-[#a9d5c9] transition-all focus:outline-none focus:ring-1 focus:ring-[#0e8177] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {text}
        </button>
      ))}
    </div>
  );
};
