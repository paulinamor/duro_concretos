const WIDTHS = ["w-36", "w-20", "w-16", "w-24", "w-14", "w-20", "w-10", "w-28"];

export default function TableSkeleton({ rows = 8, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, ri) => (
        <tr key={ri} className="border-b border-black/5 last:border-0">
          {Array.from({ length: cols }).map((_, ci) => (
            <td key={ci} className="px-4 py-3.5">
              {ci === 0 ? (
                <div className="space-y-2">
                  <div
                    className={`h-3 rounded-full bg-gradient-to-r from-gray-300 via-gray-100 to-gray-300 bg-[length:200%_auto] animate-pulse ${WIDTHS[ri % WIDTHS.length]}`}
                    style={{ animationDelay: `${ri * 60}ms` }}
                  />
                  <div
                    className="h-2.5 rounded-full bg-gradient-to-r from-gray-300 via-gray-100 to-gray-300 bg-[length:200%_auto] animate-pulse w-20"
                    style={{ animationDelay: `${ri * 60 + 80}ms` }}
                  />
                </div>
              ) : (
                <div
                  className={`h-3 rounded-full bg-gradient-to-r from-gray-300 via-gray-100 to-gray-300 bg-[length:200%_auto] animate-pulse ${WIDTHS[(ci + ri) % WIDTHS.length]}`}
                  style={{ animationDelay: `${(ri * cols + ci) * 35}ms` }}
                />
              )}
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
