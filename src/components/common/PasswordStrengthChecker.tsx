import React from 'react';
import { Check, X } from 'lucide-react';
import { validateStrongPassword } from '../../utils/validators';

interface PasswordStrengthCheckerProps {
  password?: string;
  showChecklist?: boolean;
}

export const PasswordStrengthChecker: React.FC<PasswordStrengthCheckerProps> = ({ 
  password = '', 
  showChecklist = true 
}) => {
  const v = validateStrongPassword(password);
  
  const score = [v.hasLength, v.hasUpper, v.hasLower, v.hasNumber, v.hasSpecial].filter(Boolean).length;
  
  const getBarColor = () => {
    if (score <= 2) return 'bg-rose-500';
    if (score <= 4) return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  const getStrengthText = () => {
    if (!password) return '';
    if (score <= 2) return 'Weak Password';
    if (score <= 4) return 'Moderate (Almost there)';
    return 'Strong & Secure';
  };

  if (!password && !showChecklist) return null;

  return (
    <div className="space-y-2 mt-1.5">
      {/* Strength Bar */}
      {password && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px] font-bold">
            <span className="text-slate-500">Password Strength</span>
            <span className={score === 5 ? 'text-emerald-600' : score >= 3 ? 'text-amber-600' : 'text-rose-600'}>
              {getStrengthText()}
            </span>
          </div>
          <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden flex gap-1">
            {[1, 2, 3, 4, 5].map(step => (
              <div
                key={step}
                className={`h-full flex-1 rounded-full transition-all duration-300 ${
                  step <= score ? getBarColor() : 'bg-slate-200'
                }`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Checklist */}
      {showChecklist && (
        <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] pt-1 border-t border-slate-100">
          <div className={`flex items-center gap-1.5 ${v.hasLength ? 'text-emerald-600 font-bold' : 'text-slate-400'}`}>
            {v.hasLength ? <Check className="w-3.5 h-3.5 shrink-0" /> : <X className="w-3.5 h-3.5 shrink-0" />}
            <span>At least 8 characters</span>
          </div>
          <div className={`flex items-center gap-1.5 ${v.hasUpper ? 'text-emerald-600 font-bold' : 'text-slate-400'}`}>
            {v.hasUpper ? <Check className="w-3.5 h-3.5 shrink-0" /> : <X className="w-3.5 h-3.5 shrink-0" />}
            <span>1 Uppercase (A-Z)</span>
          </div>
          <div className={`flex items-center gap-1.5 ${v.hasLower ? 'text-emerald-600 font-bold' : 'text-slate-400'}`}>
            {v.hasLower ? <Check className="w-3.5 h-3.5 shrink-0" /> : <X className="w-3.5 h-3.5 shrink-0" />}
            <span>1 Lowercase (a-z)</span>
          </div>
          <div className={`flex items-center gap-1.5 ${v.hasNumber ? 'text-emerald-600 font-bold' : 'text-slate-400'}`}>
            {v.hasNumber ? <Check className="w-3.5 h-3.5 shrink-0" /> : <X className="w-3.5 h-3.5 shrink-0" />}
            <span>1 Number (0-9)</span>
          </div>
          <div className={`col-span-2 flex items-center gap-1.5 ${v.hasSpecial ? 'text-emerald-600 font-bold' : 'text-slate-400'}`}>
            {v.hasSpecial ? <Check className="w-3.5 h-3.5 shrink-0" /> : <X className="w-3.5 h-3.5 shrink-0" />}
            <span>1 Special character (!@#$%^&*...)</span>
          </div>
        </div>
      )}
    </div>
  );
};
