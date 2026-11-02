import React, { useId } from 'react';

interface CustomCheckboxProps {
  id?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: React.ReactNode;
  disabled?: boolean;
  color?: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export const CustomCheckbox: React.FC<CustomCheckboxProps> = ({
  id,
  checked,
  onChange,
  label,
  disabled = false,
  color = '#0f766e',
  size = 20,
  className = '',
  style,
}) => {
  const generatedId = useId();
  const inputId = id || generatedId;

  return (
    <div
      className={`checkbox-wrapper ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        opacity: disabled ? 0.6 : 1,
        ...style,
      }}
    >
      <input
        id={inputId}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={e => onChange(e.target.checked)}
      />
      <label
        className="terms-label"
        htmlFor={inputId}
        style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}
      >
        <svg
          className="checkbox-svg"
          viewBox="0 0 200 200"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ width: `${size}px`, height: `${size}px`, flexShrink: 0 }}
        >
          {/* Static background outline */}
          <rect
            x="14"
            y="14"
            width="172"
            height="172"
            rx="36"
            className="checkbox-box-bg"
            stroke="#d9ece7"
            strokeWidth="24"
            fill="#ffffff"
          />
          {/* Animated perimeter box outline */}
          <rect
            x="14"
            y="14"
            width="172"
            height="172"
            rx="36"
            className="checkbox-box"
            stroke={color}
            strokeWidth="24"
            fill="none"
          />
          {/* Animated tick line */}
          <path
            d="M52 111.018L85.7316 140L148 60"
            className="checkbox-tick"
            stroke={color}
            strokeWidth="26"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {label && <span className="label-text">{label}</span>}
      </label>
    </div>
  );
};
