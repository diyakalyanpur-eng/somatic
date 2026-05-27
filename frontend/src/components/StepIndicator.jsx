export function StepIndicator({ step, total = 3 }) {
  return (
    <div className="flex flex-col gap-2" data-testid="onboarding-step-indicator">
      <div className="flex items-center gap-2">
        {Array.from({ length: total }).map((_, i) => (
          <span
            key={i}
            aria-current={i === step ? "step" : undefined}
            className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
              i < step ? "bg-[#22D3A4]" : i === step ? "bg-[#E6FBF3]" : "bg-[#13343A]"
            }`}
          />
        ))}
      </div>
      <div className="text-xs text-[#9FB8B0]">Step {step + 1} of {total}</div>
    </div>
  );
}
