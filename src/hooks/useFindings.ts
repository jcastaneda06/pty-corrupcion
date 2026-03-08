import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import {
  type Finding,
  type FindingFilters,
  type DashboardStats,
  type Severity,
} from "../types";

async function fetchFindings(filters: FindingFilters = {}): Promise<Finding[]> {
  let query = supabase.from("findings").select(`
      *,
      sources(*),
      people:finding_people(
        *,
        person:people(*)
      ),
      reactions(*)
    `);

  if (filters.sort === "date_asc") {
    query = query.order("date_reported", { ascending: true });
  } else {
    query = query.order("date_reported", { ascending: false });
  }

  if (filters.severity) {
    query = query.eq("severity", filters.severity);
  }
  if (filters.category) {
    query = query.eq("category", filters.category);
  }
  if (filters.search) {
    query = query.ilike("title", `%${filters.search}%`);
  }
  if (filters.dateFrom) {
    query = query.gte("date_reported", filters.dateFrom);
  }
  if (filters.dateTo) {
    query = query.lte("date_reported", filters.dateTo);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as Finding[];
}

async function fetchDashboardStats(): Promise<DashboardStats> {
  const { data: findings, error } = await supabase
    .from("findings")
    .select(
      "*, sources(*), people:finding_people(*, person:people(*)), reactions(*)",
    )
    .order("created_at", { ascending: false });

  if (error) throw error;

  const latestPublishedAt = (f: Finding): number => {
    const dates = (f.sources ?? [])
      .map((s) => (s.published_at ? new Date(s.published_at).getTime() : 0))
      .filter((d) => d > 0);
    return dates.length > 0
      ? Math.max(...dates)
      : new Date(f.created_at).getTime();
  };

  const all = (findings as Finding[]).sort(
    (a, b) => latestPublishedAt(b) - latestPublishedAt(a),
  );
  const recentFindings = all;

  const totalAmount = all.reduce((sum, f) => sum + (f.amount_usd ?? 0), 0);

  const bySeverity = all.reduce(
    (acc, f) => {
      acc[f.severity] = (acc[f.severity] ?? 0) + 1;
      return acc;
    },
    {} as Record<Severity, number>,
  );

  const byCategory = all.reduce(
    (acc, f) => {
      acc[f.category] = (acc[f.category] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return {
    total_findings: all.length,
    total_amount_usd: totalAmount,
    by_severity: bySeverity,
    by_category: byCategory,
    recent_findings: recentFindings,
  };
}

export function useFindings(filters: FindingFilters = {}) {
  return useQuery({
    queryKey: ["findings", filters],
    queryFn: () => fetchFindings(filters),
  });
}

export function useDashboardStats() {
  return useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: fetchDashboardStats,
  });
}
