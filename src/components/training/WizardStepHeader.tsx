type WizardStepHeaderProps = {
  step: number
  totalSteps: number
  title: string
}

export function WizardStepHeader({ step, totalSteps, title }: WizardStepHeaderProps) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
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
}
