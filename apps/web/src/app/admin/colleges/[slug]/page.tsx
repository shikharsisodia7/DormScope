import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requireAdminSession } from "@/lib/admin-auth";
import { getAdminCollegeConsole } from "@/lib/admin-data";

export const dynamic = "force-dynamic";

type DataQualityStatus = "ACTIVE" | "REVIEW" | "QUARANTINED" | "DUPLICATE" | "RETIRED";

function statusBadgeVariant(s: DataQualityStatus) {
  if (s === "ACTIVE") return "default";
  if (s === "QUARANTINED") return "destructive";
  if (s === "DUPLICATE") return "secondary";
  return "outline";
}

function kindLabel(kind: string) {
  return kind.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export default async function AdminCollegePage({ params }: { params: { slug: string } }) {
  await requireAdminSession();

  const result = await getAdminCollegeConsole(params.slug);
  if (!result) notFound();

  const { college, decisionSummary } = result;
  const { dorms, ingestCheckpoint, scrapeJobs, extractionDecisions } = college;

  return (
    <div className="site-container py-10 space-y-10">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/admin" className="text-sm text-muted-foreground hover:underline">
            ← Admin dashboard
          </Link>
          <h1 className="text-3xl font-bold mt-1">{college.name}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {college.city}, {college.state} · slug: <code className="font-mono">{college.slug}</code>
          </p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          <Badge variant="outline">{college.housingCoverageStatus}</Badge>
          {ingestCheckpoint && (
            <Badge variant="outline">
              Checkpoint: {ingestCheckpoint.stage} / {ingestCheckpoint.status}
            </Badge>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card>
          <CardHeader>
            <CardDescription>Total dorms</CardDescription>
            <CardTitle>{dorms.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Quarantined</CardDescription>
            <CardTitle className="text-destructive">
              {dorms.filter((d) => d.dataQualityStatus === "QUARANTINED").length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Extraction decisions</CardDescription>
            <CardTitle>
              {decisionSummary.accepted} accepted / {decisionSummary.rejected} rejected
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Recent scrape jobs</CardDescription>
            <CardTitle>{scrapeJobs.length}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Dorm inventory table */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Dorm inventory</h2>
        <div className="overflow-x-auto border rounded-lg">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-muted/40 text-left text-muted-foreground border-b">
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Kind</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium text-center">Assignable</th>
                <th className="px-3 py-2 font-medium">Parent</th>
                <th className="px-3 py-2 font-medium text-right">Sources</th>
                <th className="px-3 py-2 font-medium">Quarantine reason</th>
                <th className="px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {dorms.map((dorm) => {
                const sourcesCount = (dorm._count?.sources ?? 0) + (dorm._count?.dormSources ?? 0);
                const parent = dorms.find((d) => d.id === dorm.parentHousingId);
                return (
                  <tr key={dorm.id} className="border-b hover:bg-muted/20">
                    <td className="px-3 py-2 font-medium max-w-[200px] truncate" title={dorm.name}>
                      {dorm.name}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{kindLabel(dorm.entityKind)}</td>
                    <td className="px-3 py-2">
                      <Badge variant={statusBadgeVariant(dorm.dataQualityStatus as DataQualityStatus)}>
                        {dorm.dataQualityStatus}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-center">
                      {dorm.isAssignableHousingOption ? "✓" : "✗"}
                    </td>
                    <td className="px-3 py-2 text-sm text-muted-foreground max-w-[150px] truncate">
                      {parent?.name ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-right">{sourcesCount}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground max-w-[180px] truncate" title={dorm.quarantineReason ?? ""}>
                      {dorm.quarantineReason ?? "—"}
                    </td>
                    <td className="px-3 py-2">
                      <DormActions
                        dormId={dorm.id}
                        isQuarantined={dorm.dataQualityStatus === "QUARANTINED"}
                        isAssignable={dorm.isAssignableHousingOption}
                        collegeSlug={college.slug}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Merge form */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Merge dorms</h2>
        <Card>
          <CardContent className="pt-4">
            <form
              action="/api/admin/dorms/merge"
              method="POST"
              className="flex flex-wrap gap-3 items-end"
            >
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Keep (dorm ID)</label>
                <input
                  name="keepId"
                  placeholder="cuid of the canonical dorm"
                  className="border rounded px-2 py-1 text-sm w-56"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Merge (dorm ID)</label>
                <input
                  name="mergeId"
                  placeholder="cuid of the duplicate"
                  className="border rounded px-2 py-1 text-sm w-56"
                />
              </div>
              <button
                type="submit"
                className="bg-destructive text-destructive-foreground rounded px-3 py-1.5 text-sm"
              >
                Merge →
              </button>
            </form>
          </CardContent>
        </Card>
      </section>

      {/* Set hierarchy form */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Set parent/child hierarchy</h2>
        <Card>
          <CardContent className="pt-4">
            <form
              action="/api/admin/hierarchy"
              method="POST"
              className="flex flex-wrap gap-3 items-end"
            >
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Child dorm ID</label>
                <input
                  name="childId"
                  placeholder="child dorm cuid"
                  className="border rounded px-2 py-1 text-sm w-56"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Parent dorm ID (blank = none)</label>
                <input
                  name="parentId"
                  placeholder="parent dorm cuid or empty"
                  className="border rounded px-2 py-1 text-sm w-56"
                />
              </div>
              <button
                type="submit"
                className="bg-primary text-primary-foreground rounded px-3 py-1.5 text-sm"
              >
                Set parent
              </button>
            </form>
          </CardContent>
        </Card>
      </section>

      {/* Scrape jobs */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Recent scrape jobs</h2>
        <div className="overflow-x-auto border rounded-lg">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-muted/40 border-b text-left text-muted-foreground">
                <th className="px-3 py-2 font-medium">ID</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Stage</th>
                <th className="px-3 py-2 font-medium text-right">Dorms found</th>
                <th className="px-3 py-2 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {scrapeJobs.map((job) => (
                <tr key={job.id} className="border-b hover:bg-muted/20">
                  <td className="px-3 py-2 font-mono text-xs">{job.id.slice(0, 12)}…</td>
                  <td className="px-3 py-2">{job.status}</td>
                  <td className="px-3 py-2 text-muted-foreground">{job.stage ?? "—"}</td>
                  <td className="px-3 py-2 text-right">{job.dormsFound}</td>
                  <td className="px-3 py-2 text-muted-foreground">{job.createdAt.toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Extraction decisions summary */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">
          Extraction decisions (recent {extractionDecisions.length})
        </h2>
        <div className="overflow-x-auto border rounded-lg">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-muted/40 border-b text-left text-muted-foreground">
                <th className="px-3 py-2 font-medium">Candidate name</th>
                <th className="px-3 py-2 font-medium text-center">Accepted</th>
                <th className="px-3 py-2 font-medium text-right">Confidence</th>
                <th className="px-3 py-2 font-medium">Reasons</th>
              </tr>
            </thead>
            <tbody>
              {extractionDecisions.map((d) => (
                <tr key={d.id} className="border-b hover:bg-muted/20">
                  <td className="px-3 py-2">{d.candidateName}</td>
                  <td className="px-3 py-2 text-center">
                    {d.accepted ? (
                      <span className="text-green-600">✓</span>
                    ) : (
                      <span className="text-destructive">✗</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">{Math.round(d.confidence * 100)}%</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground max-w-[300px] truncate">
                    {Array.isArray(d.reasons) ? (d.reasons as string[]).join(", ") : String(d.reasons)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

// ─── Inline action form component ────────────────────────────────────────────

function DormActions({
  dormId,
  isQuarantined,
  isAssignable,
  collegeSlug: _collegeSlug,
}: {
  dormId: string;
  isQuarantined: boolean;
  isAssignable: boolean;
  collegeSlug: string;
}) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {isQuarantined ? (
        <form action={`/api/admin/dorms/${dormId}/restore`} method="POST">
          <button
            type="submit"
            className="text-xs px-2 py-1 rounded border border-green-600 text-green-700 hover:bg-green-50"
          >
            Restore
          </button>
        </form>
      ) : (
        <QuarantineForm dormId={dormId} />
      )}
      <form action={`/api/admin/dorms/${dormId}/assignability`} method="POST">
        <input type="hidden" name="assignable" value={isAssignable ? "false" : "true"} />
        <button
          type="submit"
          className="text-xs px-2 py-1 rounded border border-muted-foreground text-muted-foreground hover:bg-muted"
        >
          {isAssignable ? "Unassign" : "Assign"}
        </button>
      </form>
    </div>
  );
}

function QuarantineForm({ dormId }: { dormId: string }) {
  return (
    <form action={`/api/admin/dorms/${dormId}/quarantine`} method="POST" className="flex gap-1">
      <input
        name="reason"
        placeholder="reason"
        className="text-xs border rounded px-1.5 py-1 w-28"
      />
      <button
        type="submit"
        className="text-xs px-2 py-1 rounded border border-destructive text-destructive hover:bg-destructive/10"
      >
        Quarantine
      </button>
    </form>
  );
}
