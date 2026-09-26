import { useEffect, useState } from "react";
import StatCard from "../../components/admin/StatCard";
import StatusBadge from "../../components/admin/StatusBadge";
import {
  getAdminSubscriptionOverview,
  getAdminTransactions,
  getAdminMembershipInterestOverview,
} from "../../services/admin.service";

export default function AdminSubscriptions() {
  const [data, setData] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [interest, setInterest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const [subRes, txRes, interestRes] = await Promise.all([
          getAdminSubscriptionOverview(),
          getAdminTransactions({ limit: 10 }),
          getAdminMembershipInterestOverview(),
        ]);
        if (cancelled) return;
        setData(subRes.data?.data || null);
        setTransactions(txRes.data?.data?.transactions || []);
        setInterest(interestRes.data?.data || null);
      } catch (err) {
        if (!cancelled) setError(err.response?.data?.message || "Failed to load subscriptions");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return <div className="admin-page"><div className="admin-table-state"><div className="spinner-lg" /><span>Loading subscriptions…</span></div></div>;
  }
  if (error) {
    return <div className="admin-page"><div className="admin-error">{error}</div></div>;
  }

  const byStatus = data?.by_status || [];
  const recent = data?.recent || [];
  const paymentsEnabled = !!data?.payments_enabled;

  const interestByStatus = interest?.by_status || [];
  const interestByPlan = interest?.by_plan || [];
  const interestRecent = interest?.recent || [];

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <div>
          <p className="admin-eyebrow">Billing</p>
          <h1 className="admin-page-title">Subscriptions &amp; Payments</h1>
          <p className="admin-page-sub">
            Membership billing state and paid-plan demand. No mutations to subscriptions or
            payments happen here.
          </p>
        </div>
      </header>

      <div className="admin-panel" style={{ marginBottom: 16 }}>
        <div className="admin-panel-head">
          <h2>Payment gateway</h2>
        </div>
        <div style={{ padding: "4px 4px 12px" }}>
          <StatusBadge status={paymentsEnabled ? "active" : "incomplete"}>
            {paymentsEnabled ? "Payments enabled" : "Payments disabled"}
          </StatusBadge>{" "}
          <span style={{ marginLeft: 10, color: "var(--admin-text-muted, #888)" }}>
            {paymentsEnabled
              ? "A real payment provider is configured. Checkout and webhooks are live."
              : "Zero-cost MVP mode — no real payment gateway is required. Paid-plan clicks on the Pricing page create early-access requests below instead of a checkout or subscription."}
          </span>
        </div>
      </div>

      <div className="admin-stat-grid">
        {byStatus.length === 0 ? (
          <StatCard label="Subscriptions" value={0} hint="No subscription data yet" />
        ) : (
          byStatus.map((s) => <StatCard key={s.status} label={s.status} value={s.count} />)
        )}
      </div>

      <section className="admin-panel" style={{ marginTop: 16 }}>
        <div className="admin-panel-head"><h2>Recent subscriptions</h2></div>
        {recent.length === 0 ? (
          <div className="admin-table-empty">No subscription records yet.</div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr><th>User</th><th>Plan</th><th>Status</th><th>Provider</th><th>Period end</th><th>Updated</th></tr>
              </thead>
              <tbody>
                {recent.map((s) => (
                  <tr key={s.id}>
                    <td>#{s.user_id}</td>
                    <td>{s.plan_id}</td>
                    <td><StatusBadge status={s.status} /></td>
                    <td>{s.provider}</td>
                    <td>{s.current_period_end ? new Date(s.current_period_end).toLocaleDateString() : "—"}</td>
                    <td>{new Date(s.updatedAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="admin-panel" style={{ marginTop: 16 }}>
        <div className="admin-panel-head"><h2>Payment transactions</h2></div>
        {!paymentsEnabled && (
          <div className="admin-table-empty" style={{ paddingBottom: 4 }}>
            Payments are disabled — no real transactions are expected while the current plan is
            in effect.
          </div>
        )}
        {transactions.length === 0 ? (
          <div className="admin-table-empty">No payment history yet.</div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr><th>User</th><th>Plan</th><th>Provider</th><th>Amount</th><th>Status</th><th>When</th></tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t.id}>
                    <td>#{t.user_id}</td>
                    <td>{t.plan_id}</td>
                    <td>{t.provider}{t.is_development ? " (dev)" : ""}</td>
                    <td>{(t.amount / 100).toFixed(2)} {t.currency?.toUpperCase()}</td>
                    <td><StatusBadge status={t.status} /></td>
                    <td>{new Date(t.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="admin-panel" style={{ marginTop: 16 }}>
        <div className="admin-panel-head">
          <h2>Paid-plan early-access requests</h2>
        </div>
        <div className="admin-stat-grid" style={{ marginBottom: 12 }}>
          <StatCard label="Total requests" value={interest?.total_requests ?? 0} />
          {interestByStatus.map((s) => (
            <StatCard key={s.status} label={s.status} value={s.count} />
          ))}
          {interestByPlan.map((p) => (
            <StatCard key={p.plan_id} label={p.plan_name} value={p.count} />
          ))}
        </div>
        {interestRecent.length === 0 ? (
          <div className="admin-table-empty">No early-access requests yet.</div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr><th>User</th><th>Plan</th><th>Status</th><th>Source</th><th>Requested</th><th>Updated</th></tr>
              </thead>
              <tbody>
                {interestRecent.map((r) => (
                  <tr key={r.id}>
                    <td>#{r.user_id}</td>
                    <td>{r.plan_name}</td>
                    <td><StatusBadge status={r.status} /></td>
                    <td>{r.source}</td>
                    <td>{new Date(r.requested_at).toLocaleString()}</td>
                    <td>{new Date(r.updated_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
