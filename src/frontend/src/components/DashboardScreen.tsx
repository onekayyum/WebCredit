import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Menu,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { useMemo } from "react";
import type { Screen } from "../App";
import { useAllCustomers } from "../hooks/useQueries";
import { formatCurrency, getSettings } from "../utils/format";

interface Props {
  navigate: (s: Screen) => void;
  onOpenSidebar: () => void;
}

export function DashboardScreen({ navigate, onOpenSidebar }: Props) {
  const { data: customers, isLoading } = useAllCustomers();
  const settings = getSettings();

  const stats = useMemo(() => {
    if (!customers) return null;
    const totalCustomers = customers.length;
    const totalUdhaar = customers.reduce((s, c) => s + c.totalUdhaar, 0);
    const totalReceived = customers.reduce((s, c) => s + c.totalPaid, 0);
    const totalBalance = customers.reduce((s, c) => s + c.remainingBalance, 0);
    const highBalance = customers.filter(
      (c) => c.remainingBalance > settings.threshold,
    ).length;
    const withBalance = customers.filter((c) => c.remainingBalance > 0).length;

    return {
      totalCustomers,
      totalUdhaar,
      totalReceived,
      totalBalance,
      highBalance,
      withBalance,
    };
  }, [customers, settings.threshold]);

  return (
    <div className="screen-container">
      {/* Header */}
      <div className="app-header px-4 pt-12 pb-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              data-ocid="dashboard.sidebar.toggle"
              onClick={onOpenSidebar}
              className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center text-white hover:bg-white/20 flex-shrink-0"
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>
            <div>
              <h1 className="text-white text-xl font-bold">Dashboard</h1>
              <p className="text-white/60 text-xs mt-0.5">Business overview</p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="scroll-area px-4 py-5 space-y-4 pb-8">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-28 rounded-2xl" />
            ))}
          </div>
        ) : (
          <>
            {/* Top row: large stat cards */}
            <div className="grid grid-cols-2 gap-3">
              <StatCard
                icon={<Wallet size={22} className="text-white" />}
                label="Total Balance Due"
                value={formatCurrency(stats?.totalBalance ?? 0)}
                sub={`${stats?.withBalance ?? 0} customers owe`}
                color="bg-destructive"
              />
              <StatCard
                icon={<ArrowUpCircle size={22} className="text-white" />}
                label="Total Udhaar Given"
                value={formatCurrency(stats?.totalUdhaar ?? 0)}
                sub="All time"
                color="bg-amber-500"
              />
              <StatCard
                icon={<ArrowDownCircle size={22} className="text-white" />}
                label="Total Received"
                value={formatCurrency(stats?.totalReceived ?? 0)}
                sub="All time"
                color="bg-emerald-600"
              />
              <StatCard
                icon={<Users size={22} className="text-white" />}
                label="Total Customers"
                value={String(stats?.totalCustomers ?? 0)}
                sub={`${stats?.highBalance ?? 0} high balance`}
                color="bg-primary"
              />
            </div>

            {/* Recovery rate */}
            {stats && stats.totalUdhaar > 0 && (
              <div className="rounded-2xl border border-border bg-card p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp size={18} className="text-primary" />
                    <span className="text-sm font-semibold text-foreground">
                      Recovery Rate
                    </span>
                  </div>
                  <span className="text-sm font-bold text-primary">
                    {Math.round(
                      (stats.totalReceived / stats.totalUdhaar) * 100,
                    )}
                    %
                  </span>
                </div>
                <div className="w-full bg-muted rounded-full h-2.5">
                  <div
                    className="bg-primary h-2.5 rounded-full transition-all"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.round(
                          (stats.totalReceived / stats.totalUdhaar) * 100,
                        ),
                      )}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {formatCurrency(stats.totalReceived)} recovered of{" "}
                  {formatCurrency(stats.totalUdhaar)} given
                </p>
              </div>
            )}

            {/* Quick actions */}
            <div className="rounded-2xl border border-border bg-card p-4">
              <p className="text-sm font-semibold text-foreground mb-3">
                Quick Actions
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => navigate({ id: "udhar" })}
                  className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-muted hover:bg-muted/80 transition-colors"
                >
                  <Users size={20} className="text-primary" />
                  <span className="text-xs font-medium text-foreground">
                    Customers / Udhar
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => navigate({ id: "products" })}
                  className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-muted hover:bg-muted/80 transition-colors"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-primary"
                    aria-label="Products"
                  >
                    <title>Products</title>
                    <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
                    <path d="m3.3 7 8.7 5 8.7-5" />
                    <path d="M12 22V12" />
                  </svg>
                  <span className="text-xs font-medium text-foreground">
                    Products
                  </span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  color: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 flex flex-col gap-3">
      <div
        className={`w-9 h-9 rounded-xl ${color} flex items-center justify-center`}
      >
        {icon}
      </div>
      <div>
        <p className="text-lg font-bold text-foreground leading-tight">
          {value}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
        <p className="text-[10px] text-muted-foreground/70 mt-0.5">{sub}</p>
      </div>
    </div>
  );
}
