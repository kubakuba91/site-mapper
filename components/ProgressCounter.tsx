type Props = {
  matched: number;
  dropped: number;
  unmatched: number;
  total: number;
};

export default function ProgressCounter({ matched, dropped, unmatched, total }: Props) {
  return (
    <div className="flex items-center gap-4 text-base font-bold text-neutral-900">
      <span className="text-green-700">{matched} matched</span>
      <span className="text-neutral-300">·</span>
      <span className="text-neutral-600">{dropped} dropped</span>
      <span className="text-neutral-300">·</span>
      <span className="text-amber-700">{unmatched} unmatched</span>
      <span className="font-medium text-neutral-500">of {total} old pages</span>
    </div>
  );
}
