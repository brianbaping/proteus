import React from "react";
interface StatCardProps {
  label: string;
  value: string | number;
}

export function StatCard({ label, value }: StatCardProps): React.JSX.Element {
  return (
    <div className="bg-bg-3 rounded-lg p-4 border border-border">
      <div className="text-fg-muted text-2xs uppercase tracking-wider mb-1">{label}</div>
      <div className="text-fg text-2xl font-bold">{value}</div>
    </div>
  );
}
