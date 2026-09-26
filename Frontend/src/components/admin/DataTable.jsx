export default function DataTable({
  columns = [],
  rows = [],
  loading = false,
  emptyMessage = "No records found.",
  onRowClick,
  keyField = "id",
}) {
  if (loading) {
    return (
      <div className="admin-table-state">
        <div className="spinner-lg" />
        <span>Loading…</span>
      </div>
    );
  }

  if (!rows.length) {
    return <div className="admin-table-state admin-table-empty">{emptyMessage}</div>;
  }

  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} style={c.width ? { width: c.width } : undefined}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row[keyField] ?? JSON.stringify(row)}
              className={onRowClick ? "admin-table-clickable" : undefined}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {columns.map((c) => (
                <td key={c.key}>
                  {c.render ? c.render(row) : row[c.key] ?? "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
