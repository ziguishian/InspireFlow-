import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface SelectOption {
  value: string;
  label: string;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  customStyle?: {
    background?: string;
    borderColor?: string;
    textColor?: string;
  };
}

const CustomSelect: React.FC<CustomSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = '请选择',
  className = '',
  disabled = false,
  size = 'md',
  customStyle,
}) => {
  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-2 text-sm',
    lg: 'px-4 py-3 text-base',
  };
  const [isOpen, setIsOpen] = useState(false);
  const selectRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const selectedOption = options.find((opt) => opt.value === value);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });

  // 计算下拉列表位置（fixed 定位用视口坐标）
  const updateDropdownPosition = () => {
    if (selectRef.current) {
      const rect = selectRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    }
  };

  useEffect(() => {
    if (isOpen) updateDropdownPosition();
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        selectRef.current &&
        !selectRef.current.contains(event.target as Node) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleScroll = () => {
      if (isOpen) updateDropdownPosition();
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('scroll', handleScroll, true);
      window.addEventListener('resize', handleScroll);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        window.removeEventListener('scroll', handleScroll, true);
        window.removeEventListener('resize', handleScroll);
      };
    }
  }, [isOpen]);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  return (
    <div ref={selectRef} className={`relative ${className}`}>
      {/* 下拉框按钮 */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) setIsOpen(!isOpen);
        }}
        onMouseDown={(e) => e.stopPropagation()}
        disabled={disabled}
        className={`
          nodrag w-full glass ${sizeClasses[size]} rounded-lg 
          ${customStyle?.textColor || 'text-diffusion-text-primary'}
          ${customStyle ? '' : 'bg-diffusion-bg-tertiary/50 border border-diffusion-border'}
          focus:outline-none
          flex items-center justify-between gap-2
          transition-all duration-200
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90 cursor-pointer'}
          ${isOpen ? 'ring-2 ring-diffusion-glow-cyan/20' : ''}
        `}
        style={customStyle ? {
          background: customStyle.background,
          borderColor: customStyle.borderColor,
          color: customStyle.textColor,
          boxShadow: customStyle.borderColor ? `inset 0 0 0 1px ${customStyle.borderColor}33` : undefined,
        } : undefined}
      >
        <span className={`${sizeClasses[size]} truncate flex-1 text-left`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          size={16}
          className={`text-diffusion-text-secondary transition-transform duration-150 flex-shrink-0 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* 下拉选项列表 - 使用 Portal 渲染到 body，避免被 overflow hidden 裁剪 */}
      {isOpen &&
        createPortal(
          <>
            {/* 背景遮罩 */}
            <div
              className="fixed inset-0 z-[9998]"
              onClick={() => setIsOpen(false)}
            />
            <AnimatePresence>
              <motion.div
                ref={dropdownRef}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.1 }}
                className="fixed z-[9999] glass-strong rounded-xl border border-diffusion-border shadow-2xl p-2 min-w-[200px]"
                style={{
                  top: `${dropdownPosition.top}px`,
                  left: `${dropdownPosition.left}px`,
                  width: `${dropdownPosition.width}px`,
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="space-y-1 max-h-[400px] overflow-y-auto scrollbar-hidden">
                  {options.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-diffusion-text-muted text-center">
                      暂无选项
                    </div>
                  ) : (
                    options.map((option) => {
                      const isSelected = option.value === value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelect(option.value);
                          }}
                          onMouseDown={(e) => e.stopPropagation()}
                          className={`
                            nodrag w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm
                            text-diffusion-text-primary hover:bg-diffusion-bg-tertiary
                            transition-colors text-left
                            ${isSelected ? 'bg-diffusion-bg-tertiary/50' : ''}
                          `}
                        >
                          <span>{option.label}</span>
                        </button>
                      );
                    })
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          </>,
          document.body
        )}
    </div>
  );
};

export default CustomSelect;
