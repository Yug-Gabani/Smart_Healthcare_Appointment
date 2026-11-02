import React, { useState, useRef, useEffect, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, Check, Search, X } from 'lucide-react';
import { EASE_ENTER } from '../motion/presets';

export interface SelectOption {
  value: string;
  label: string;
}

interface CustomSelectProps {
  value: string;
  options: (SelectOption | string)[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  variant?: 'pill' | 'input' | 'borderless';
  style?: React.CSSProperties;
  minWidth?: string | number;
  searchable?: boolean;
  searchPlaceholder?: string;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  value,
  options,
  onChange,
  placeholder = 'Select...',
  disabled = false,
  variant = 'pill',
  style,
  minWidth,
  searchable,
  searchPlaceholder,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Normalize options
  const normalizedOptions: SelectOption[] = useMemo(() => {
    return options.map(opt =>
      typeof opt === 'string' ? { value: opt, label: opt } : opt
    );
  }, [options]);

  const shouldShowSearch = searchable ?? (normalizedOptions.length >= 7);

  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return normalizedOptions;
    const q = searchQuery.toLowerCase().trim();
    return normalizedOptions.filter(opt =>
      opt.label.toLowerCase().includes(q) || opt.value.toLowerCase().includes(q)
    );
  }, [normalizedOptions, searchQuery]);

  const selectedOption = normalizedOptions.find(opt => opt.value === value);

  useEffect(() => {
    if (isOpen && shouldShowSearch) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    } else {
      setSearchQuery('');
    }
  }, [isOpen, shouldShowSearch]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const getVariantStyles = (): React.CSSProperties => {
    switch (variant) {
      case 'borderless':
        return {
          backgroundColor: 'transparent',
          border: 'none',
          padding: '6px 20px 6px 0',
          fontSize: '14px',
          fontWeight: 600,
          color: '#0b3f3a',
          fontFamily: "'Space Grotesk', sans-serif",
        };
      case 'input':
        return {
          backgroundColor: '#ffffff',
          border: '1px solid #d9ece7',
          borderRadius: '10px',
          padding: '10px 32px 10px 14px',
          fontSize: '14px',
          fontWeight: 500,
          color: '#0b3f3a',
          boxShadow: '0 2px 10px rgba(20, 60, 55, 0.08)',
          fontFamily: "'Space Grotesk', sans-serif",
        };
      case 'pill':
      default:
        return {
          backgroundColor: '#ffffff',
          border: '1px solid #d9ece7',
          borderRadius: '9999px',
          padding: '7px 28px 7px 14px',
          fontSize: '13px',
          fontWeight: 500,
          color: '#0b3f3a',
          boxShadow: '0 2px 10px rgba(20, 60, 55, 0.08)',
          fontFamily: "'Space Grotesk', sans-serif",
        };
    }
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        display: 'inline-block',
        minWidth: minWidth ?? (variant === 'input' ? '140px' : undefined),
        zIndex: isOpen ? 100 : 'auto',
        ...style,
      }}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        style={{
          ...getVariantStyles(),
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.6 : 1,
          fontFamily: "'Space Grotesk', sans-serif",
          outline: 'none',
          position: 'relative',
          transition: 'border-color 150ms ease, box-shadow 150ms ease',
        }}
        onMouseEnter={e => {
          if (!disabled && variant !== 'borderless') {
            e.currentTarget.style.borderColor = '#0f766e';
          }
        }}
        onMouseLeave={e => {
          if (!disabled && variant !== 'borderless' && !isOpen) {
            e.currentTarget.style.borderColor = '#d9ece7';
          }
        }}
      >
        <span
          style={{
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.18, ease: EASE_ENTER }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            color: '#0f766e',
            flexShrink: 0,
            position: variant === 'borderless' ? 'absolute' : undefined,
            right: variant === 'borderless' ? 0 : undefined,
          }}
        >
          <ChevronDown size={14} />
        </motion.div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.18, ease: EASE_ENTER }}
            style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              left: 0,
              minWidth: '100%',
              width: 'max-content',
              maxWidth: '300px',
              backgroundColor: '#ffffff',
              border: '1px solid #d9ece7',
              borderRadius: '14px',
              padding: '6px',
              boxShadow: '0 12px 30px rgba(11, 63, 58, 0.16), 0 2px 8px rgba(11, 63, 58, 0.08)',
              zIndex: 1000,
              maxHeight: '260px',
              overflowY: 'auto',
              fontFamily: "'Space Grotesk', sans-serif",
            }}
          >
            {shouldShowSearch && (
              <div
                style={{
                  position: 'sticky',
                  top: 0,
                  backgroundColor: '#ffffff',
                  padding: '4px 4px 8px',
                  borderBottom: '1px solid #eef5f3',
                  marginBottom: '4px',
                  zIndex: 2,
                }}
              >
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <Search
                    size={13}
                    color="#0f766e"
                    style={{ position: 'absolute', left: '8px', pointerEvents: 'none' }}
                  />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && filteredOptions.length > 0) {
                        e.preventDefault();
                        onChange(filteredOptions[0].value);
                        setIsOpen(false);
                        setSearchQuery('');
                      }
                    }}
                    placeholder={searchPlaceholder || 'Type to filter…'}
                    style={{
                      width: '100%',
                      padding: '6px 24px 6px 26px',
                      fontSize: '12px',
                      borderRadius: '8px',
                      border: '1px solid #d9ece7',
                      outline: 'none',
                      backgroundColor: '#f8faf9',
                      color: '#0b3f3a',
                      fontFamily: "'Space Grotesk', sans-serif",
                      boxSizing: 'border-box',
                    }}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      style={{
                        position: 'absolute',
                        right: '6px',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '2px',
                        color: '#8aa39d',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>
            )}

            {filteredOptions.length === 0 ? (
              <div style={{ padding: '12px 14px', textAlign: 'center', color: '#8aa39d', fontSize: '12px' }}>
                No matches for "{searchQuery}"
              </div>
            ) : (
              filteredOptions.map(opt => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                      setSearchQuery('');
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: 'none',
                      backgroundColor: isSelected ? '#eaf6f2' : 'transparent',
                      color: isSelected ? '#0f766e' : '#0b3f3a',
                      fontWeight: isSelected ? 600 : 400,
                      fontSize: '13px',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      gap: '12px',
                      transition: 'background-color 120ms ease, color 120ms ease',
                    }}
                    onMouseEnter={e => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = '#eaf6f2';
                        e.currentTarget.style.color = '#0f766e';
                      }
                    }}
                    onMouseLeave={e => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = '#0b3f3a';
                      }
                    }}
                  >
                    <span style={{ whiteSpace: 'nowrap' }}>{opt.label}</span>
                    {isSelected && <Check size={14} color="#0f766e" style={{ flexShrink: 0 }} />}
                  </button>
                );
              })
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
