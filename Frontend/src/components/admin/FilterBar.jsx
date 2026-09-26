export default function FilterBar({ children, onSubmit, onReset }) {
  return (
    <form
      className="admin-filter-bar"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit?.();
      }}
    >
      <div className="admin-filter-fields">{children}</div>
      <div className="admin-filter-actions">
        <button type="submit" className="btn-primary">
          Apply
        </button>
        {onReset ? (
          <button type="button" className="btn-secondary" onClick={onReset}>
            Reset
          </button>
        ) : null}
      </div>
    </form>
  );
}
