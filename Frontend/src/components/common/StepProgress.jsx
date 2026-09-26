// Fixed StepProgress Component
export default function StepProgress({ steps, currentStep }) {
  const isLargeStepper = steps.length > 5;

  return (
    <div className="flex items-center justify-center gap-2 my-8 max-w-2xl mx-auto px-4 overflow-x-auto py-2">
      {steps.map((label, i) => {
        const stepNum = i + 1;
        const isDone = stepNum < currentStep;
        const isActive = stepNum === currentStep;

        return (
          <div key={i} className="flex items-center gap-2">
            {/* Step Circle */}
            <div
              title={label}
              className={`relative flex items-center justify-center font-semibold text-xs transition-all duration-200 rounded-full cursor-pointer flex-shrink-0 ${
                isActive
                  ? 'w-7 h-7 bg-[var(--cyan)] text-white ring-4 ring-[var(--cyan)]/20 shadow-md shadow-[var(--cyan)]/20'
                  : isDone
                  ? 'w-6 h-6 bg-[var(--cyan)]/15 text-[var(--cyan)] border border-[var(--cyan)]/30'
                  : 'w-6 h-6 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700'
              }`}
            >
              {isDone ? (
                <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : (
                stepNum
              )}
            </div>

            {/* Label Logic: If large stepper (>5 steps), only show active/done text cleanly */}
            {(!isLargeStepper || isActive) && (
              <span
                className={`text-xs font-semibold whitespace-nowrap transition-colors ${
                  isActive
                    ? 'text-[var(--cyan)]'
                    : 'text-slate-400 dark:text-slate-500'
                }`}
              >
                {label}
              </span>
            )}

            {/* Connecting Line */}
            {i < steps.length - 1 && (
              <div
                className={`h-[2px] transition-colors ${
                  isLargeStepper ? 'w-4 sm:w-6' : 'w-6 sm:w-10'
                } ${
                  isDone ? 'bg-[var(--cyan)]' : 'bg-slate-200 dark:bg-slate-800'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}