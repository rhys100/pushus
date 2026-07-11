import { forwardRef } from 'react'

type WizardStepHeaderProps = {
  step: number
  totalSteps: number
  title: string
}

export const WizardStepHeader = forwardRef<HTMLParagraphElement, WizardStepHeaderProps>(
  function WizardStepHeader({ step, totalSteps, title }, ref) {
    return (
      <div className="space-y-2">
        <p
          ref={ref}
          tabIndex={-1}
          className="text-xs font-medium uppercase tracking-wide text-text-muted outline-none"
        >
          Step {step + 1} of {totalSteps} · {title}
        </p>
        <div className="flex items-center gap-2">
          {Array.from({ length: totalSteps }, (_, index) => (
            <span
              key={index}
              className={`h-1.5 flex-1 rounded-full ${step >= index ? 'bg-accent' : 'bg-border'}`}
            />
          ))}
        </div>
      </div>
    )
  },
)
