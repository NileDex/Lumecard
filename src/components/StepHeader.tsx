import { ArrowLeft } from "lucide-react";

interface Props {
  title: string;
  step: number;
  total: number;
  onBack?: () => void;
}

export function StepHeader({ title, step, total, onBack }: Props) {
  const pct = ((step + 1) / total) * 100;
  return (
    <div className="mb-6 pt-8">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          disabled={!onBack}
          aria-label="Back"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 disabled:invisible"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1">
          <p className="text-xs font-medium uppercase tracking-wider text-neutral-400">
            Step {step + 1} of {total}
          </p>
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        </div>
      </div>
      <div className="mt-4 h-1 overflow-hidden rounded-full bg-neutral-200/70">
        <div className="h-full rounded-full bg-brand-600 transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
