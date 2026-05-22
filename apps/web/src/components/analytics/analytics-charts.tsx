"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6"];

export function AnalyticsCharts({ data }: { data: Record<string, unknown> }) {
  const totals = data.totals as { dorms: number; withAC: number; suiteBathrooms: number; freshmanOnly: number };
  const stateStats = (data.stateStats as { state: string; avgCost: number; dormCount: number }[]) ?? [];
  const bathroomDist = (data.bathroomDist as { name: string; count: number }[]) ?? [];
  const scoreDistribution = (data.scoreDistribution as { range: string; count: number }[]) ?? [];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Dorms indexed" value={totals.dorms} />
        <StatCard label="% with AC" value={`${totals.withAC}%`} />
        <StatCard label="% suite baths" value={`${totals.suiteBathrooms}%`} />
        <StatCard label="% freshman-only" value={`${totals.freshmanOnly}%`} />
      </div>

      <ChartBox title="Average dorm cost by state">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={stateStats.slice(0, 10)}>
            <XAxis dataKey="state" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="avgCost" fill="#3b82f6" name="Avg cost ($)" />
          </BarChart>
        </ResponsiveContainer>
      </ChartBox>

      <div className="grid md:grid-cols-2 gap-6">
        <ChartBox title="Bathroom style distribution">
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={bathroomDist} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                {bathroomDist.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </ChartBox>
        <ChartBox title="Dorm score distribution">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={scoreDistribution}>
              <XAxis dataKey="range" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </ChartBox>
      </div>

      <div className="grid md:grid-cols-2 gap-4 text-sm">
        <p>Public schools avg: ${(data.publicAvgCost as number)?.toLocaleString() ?? "—"}/yr</p>
        <p>Private schools avg: ${(data.privateAvgCost as number)?.toLocaleString() ?? "—"}/yr</p>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border rounded-xl p-4 text-center">
      <p className="text-2xl font-bold text-primary">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

function ChartBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border rounded-xl p-4">
      <h3 className="font-semibold mb-4">{title}</h3>
      {children}
    </div>
  );
}
