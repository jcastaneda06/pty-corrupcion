import { formatMoney } from '../../lib/utils';

interface Props {
  amount: number | null | undefined;
  className?: string;
  showLabel?: boolean;
}

export function MoneyAmount({ amount, className = '', showLabel = true }: Props) {
  if (amount == null) return null;

  return (
    <span className={`font-mono font-semibold text-emerald-400 ${className}`}>
      {showLabel && <span className="text-gray-500 font-sans font-normal text-xs mr-1">USD</span>}
      {formatMoney(amount)}
    </span>
  );
}
