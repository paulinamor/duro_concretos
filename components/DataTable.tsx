interface Column<T> {
  header: string;
  accessor: keyof T | ((row: T) => React.ReactNode);
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  emptyMessage?: string;
}

export default function DataTable<T>({
  columns,
  data,
  emptyMessage = "Sin datos",
}: DataTableProps<T>) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[#3A3A3A]">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-[#1A1A1A] border-b border-[#3A3A3A]">
            {columns.map((col, i) => (
              <th
                key={i}
                className={`px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap ${col.className ?? ""}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#3A3A3A]">
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-8 text-center text-gray-500"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, ri) => (
              <tr
                key={ri}
                className="bg-[#242424] hover:bg-[#2A2A2A] transition-colors"
              >
                {columns.map((col, ci) => (
                  <td
                    key={ci}
                    className={`px-4 py-3 text-gray-200 whitespace-nowrap ${col.className ?? ""}`}
                  >
                    {typeof col.accessor === "function"
                      ? col.accessor(row)
                      : (row[col.accessor] as React.ReactNode)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
