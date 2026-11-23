import React, { useState, useId } from 'react';

export interface WaveInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label: string;
  value: string;
  onChange: (value: string) => void;
  icon?: React.ReactNode;
  rightElement?: React.ReactNode;
  leftElement?: React.ReactNode;
  containerStyle?: React.CSSProperties;
  variant?: 'boxed' | 'underline';
}

export const WaveInput: React.FC<WaveInputProps> = ({
  label,
  value,
  onChange,
  icon,
  rightElement,
  leftElement,
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

  // Boxed Clean Flex Input Variant (Unslopped, zero-overlap, high contrast)
  if (variant === 'boxed') {
    return (
      <div className={`boxed-input-group ${className}`} style={{ marginBottom: '14px', ...containerStyle }}>
        <label
          htmlFor={inputId}
          style={{
            display: 'block',
            fontSize: '12.5px',
            fontWeight: 500,
            color: '#334155',
            marginBottom: '6px',
            letterSpacing: '-0.01em',
          }}
        >
          {label}
        </label>
        <div
          className={`boxed-input-wrapper ${isFocused ? 'is-focused' : ''}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            width: '100%',
            height: '44px',
            border: `1.5px solid ${isFocused ? '#0f766e' : '#e2e8f0'}`,
            borderRadius: '10px',
            backgroundColor: '#ffffff',
            boxShadow: isFocused ? '0 0 0 3px rgba(15, 118, 110, 0.12)' : 'none',
            transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
            padding: '0 12px',
            boxSizing: 'border-box',
            overflow: 'hidden',
          }}
        >
          {icon && (
            <div
              style={{
                marginRight: '8px',
                color: isFocused ? '#0f766e' : '#94a3b8',
                display: 'flex',
                alignItems: 'center',
                flexShrink: 0,
                transition: 'color 0.15s ease',
              }}
            >
              {icon}
            </div>
          )}
          {leftElement && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                marginRight: '8px',
                flexShrink: 0,
              }}
            >
              {leftElement}
            </div>
          )}
          <input
            id={inputId}
            type={type}
            value={value}
            onChange={e => onChange(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            required={required}
            disabled={disabled}
            placeholder={rest.placeholder || `Enter your ${label.toLowerCase()}`}
            className="boxed-input"
            style={{
              flex: 1,
              width: '100%',
              minWidth: 0,
              height: '100%',
              border: 'none',
              outline: 'none',
              backgroundColor: 'transparent',
              backgroundImage: 'none',
              boxShadow: 'none',
              fontSize: '13.5px',
              color: '#0f172a',
              fontFamily: "'Space Grotesk', sans-serif",
              padding: 0,
              boxSizing: 'border-box',
              ...style,
            }}
            {...rest}
          />
          {rightElement && (
            <div
              style={{
                marginLeft: '8px',
                display: 'flex',
                alignItems: 'center',
                flexShrink: 0,
              }}
            >
              {rightElement}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Underline Animated Variant (Default fallback)
  const isActive = isFocused || (value !== undefined && value !== null && value.toString().length > 0);

  return (
    <div
      className={`input-container wave-group ${isActive ? 'is-active' : ''} ${className}`}
      style={containerStyle}
    >
      {icon && <div className="icon-left">{icon}</div>}
      {leftElement && <div className="element-left">{leftElement}</div>}

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
        className={`input ${leftElement ? 'has-left-element' : ''}`}
        style={style}
        {...rest}
      />

      <span className="bar"></span>

      <label htmlFor={inputId} className={`label ${leftElement ? 'has-left-element' : ''}`}>
        {label.split('').map((char, index) => (
          <span
            key={index}
            className="wave-char"
            style={{
              transitionDelay: `${index * 30}ms`,
            }}
          >
            {char === ' ' ? '\u00A0' : char}
          </span>
        ))}
      </label>

      {rightElement && <div className="element-right">{rightElement}</div>}
      <div className="underline"></div>
    </div>
  );
};
