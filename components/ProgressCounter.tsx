type Props = {
  matched: number;
  dropped: number;
  unmatched: number;
  total: number;
};

export default function ProgressCounter({ matched, dropped, unmatched, total }: Props) {
  return (
    <div className="flex items-center gap-4 text-sm font-medium text-neutral-700">
      <span className="text-green-600">{matched} matched</span>
      <span className="text-neutral-300">·</span>
      <span className="text-neutral-500">{dropped} dropped</span>
      <span className="text-neutral-300">·</span>
      <span className="text-amber-600">{unmatched} unmatched</span>
      <span className="text-neutral-400">of {total} old pages</span>
    </div>
  );
}
