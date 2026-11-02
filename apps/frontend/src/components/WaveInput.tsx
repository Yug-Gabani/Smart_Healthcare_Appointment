import React, { useState, useId } from 'react';

export interface WaveInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label: string;
  value: string;
  onChange: (value: string) => void;
  icon?: React.ReactNode;
  rightElement?: React.ReactNode;
  containerStyle?: React.CSSProperties;
  variant?: 'boxed' | 'underline';
}

export const WaveInput: React.FC<WaveInputProps> = ({
  label,
  value,
  onChange,
  icon,
  rightElement,
  type = 'text',
  id,
  required = false,
  disabled = false,
  variant = 'underline',
  style,
  containerStyle,
  className = '',
  ...rest
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const generatedId = useId();
  const inputId = id || generatedId;

  const isActive = isFocused || (value !== undefined && value !== null && value.toString().length > 0);

  return (
    <div
      className={`input-container wave-group ${isActive ? 'is-active' : ''} ${className}`}
      style={containerStyle}
    >
      {icon && <div className="icon-left">{icon}</div>}

      <input
        id={inputId}
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        required={required}
        disabled={disabled}
        placeholder=" "
        className={`input ${icon ? 'has-icon' : ''} ${rightElement ? 'has-right-element' : ''}`}
        style={style}
        {...rest}
      />

      <label className={`label ${icon ? 'has-icon' : ''}`} htmlFor={inputId}>
        {label}
      </label>

      <span className="underline"></span>

      {rightElement && <div className="element-right">{rightElement}</div>}
    </div>
  );
};
