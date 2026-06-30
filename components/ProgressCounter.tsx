type Props = {
  matched: number;
  dropped: number;
  unmatched: number;
  total: number;
};

export default function ProgressCounter({ matched, dropped, unmatched, total }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3.5 font-mono text-[13px]">
      <span className="inline-flex items-center gap-1.5 font-semibold text-[#1B9E68]">
        <span className="h-2 w-2 rounded-full bg-[#1FAE6B]" />
        {matched} matched
      </span>
      <span className="text-[#C9CDD4]">·</span>
      <span className="inline-flex items-center gap-1.5 text-[#6B7280]">
        <span className="h-2 w-2 rounded-full bg-[#C5CAD2]" />
        {dropped} dropped
      </span>
      <span className="text-[#C9CDD4]">·</span>
      <span className="inline-flex items-center gap-1.5 font-semibold text-[#C2620E]">
        <span className="h-2 w-2 rounded-full bg-[#E0922F]" />
        {unmatched} unmatched
      </span>
      <span className="text-[#A4A9B4]">of {total}</span>
    </div>
  );
}
