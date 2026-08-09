"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import type { DormCardData } from "@/components/dorms/dorm-card";

const COLORS = ["#0B6E4F", "#6B9B7A", "#D4A017", "#4A6B5C", "#8B7355"];

export function CollegeCharts({ dorms }: { dorms: DormCardData[] }) {
  const bathroomDist = ["COMMUNAL", "SUITE", "PRIVATE", "UNKNOWN"].map((b) => ({
    name: b.replace("_", " "),
    count: dorms.filter((d) => d.bathroomStyle === b).length,
  })).filter((x) => x.count > 0);

  const costRanges = [
    { range: "<12k", count: dorms.filter((d) => (d.yearlyCost ?? 0) < 12000).length },
    { range: "12-16k", count: dorms.filter((d) => (d.yearlyCost ?? 0) >= 12000 && (d.yearlyCost ?? 0) < 16000).length },
    { range: "16-20k", count: dorms.filter((d) => (d.yearlyCost ?? 0) >= 16000 && (d.yearlyCost ?? 0) < 20000).length },
    { range: "20k+", count: dorms.filter((d) => (d.yearlyCost ?? 0) >= 20000).length },
  ].filter((x) => x.count > 0);

  const scores = dorms
    .filter((d) => d.dormScore)
    .map((d) => ({ name: d.name.slice(0, 12), score: d.dormScore!.overallScore }));

  if (!dorms.length) return null;

  return (
    <div className="grid md:grid-cols-3 gap-6">
      <div className="border rounded-xl p-4 h-64">
        <h3 className="font-semibold mb-2 text-sm">Bathroom types</h3>
        <ResponsiveContainer width="100%" height="90%">
          <PieChart>
            <Pie data={bathroomDist} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>
              {bathroomDist.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="border rounded-xl p-4 h-64">
        <h3 className="font-semibold mb-2 text-sm">Cost ranges</h3>
        <ResponsiveContainer width="100%" height="90%">
          <BarChart data={costRanges}>
            <XAxis dataKey="range" fontSize={12} />
            <YAxis allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="border rounded-xl p-4 h-64">
        <h3 className="font-semibold mb-2 text-sm">Dorm scores</h3>
        <ResponsiveContainer width="100%" height="90%">
          <BarChart data={scores} layout="vertical">
            <XAxis type="number" domain={[0, 100]} />
            <YAxis dataKey="name" type="category" width={70} fontSize={10} />
            <Tooltip />
            <Bar dataKey="score" fill="#10b981" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
