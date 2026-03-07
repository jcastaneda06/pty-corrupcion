import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BarChart2, ChevronRight, TrendingUp } from "lucide-react";
import { useDashboardStats } from "../hooks/useFindings";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { SeverityBadge } from "@/components/app/SeverityBadge";
import { formatMoney, formatDate, SEVERITY_COLORS } from "../lib/utils";
import { type Finding } from "../types";

const SECTION_LABEL =
  "text-sm font-semibold text-gray-400 uppercase tracking-wider";
const SECTION_HEADER = "flex items-start justify-between px-4 sm:px-0";
const SECTION_CTA =
  "flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300 transition-colors";

export function Dashboard() {
  const { data: stats, isLoading, error } = useDashboardStats();
  const recentFindings = (stats?.recent_findings ?? []).slice(0, 3);

  const weeklyBins = useMemo(() => {
    const findings = stats?.recent_findings ?? [];
    const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;
    const WEEKS = 10;
    const bins = new Array(WEEKS).fill(0);
    for (const f of findings) {
      const weeksAgo = Math.floor(
        (Date.now() - new Date(f.created_at).getTime()) / MS_PER_WEEK,
      );
      if (weeksAgo >= 0 && weeksAgo < WEEKS) bins[WEEKS - 1 - weeksAgo]++;
    }
    return bins;
  }, [stats?.recent_findings]);

  return (
    <main className="max-w-7xl mx-auto px-0 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Comprometido */}
      <div className={SECTION_HEADER}>
        <div>
          <h2 className={SECTION_LABEL}>Comprometido</h2>
          <Tooltip>
            <TooltipTrigger asChild>
              <p className="text-xl font-bold font-mono text-emerald-400 mt-0.5">
                {isLoading ? "…" : formatMoney(stats?.total_amount_usd ?? 0)}
              </p>
            </TooltipTrigger>
            <TooltipContent className="bg-dark-700 border-dark-500 text-gray-200">
              {`$${Number(stats?.total_amount_usd).toLocaleString("es-PA")}`}
            </TooltipContent>
          </Tooltip>
        </div>
        <Link to="/estadisticas" className={SECTION_CTA}>
          <BarChart2 className="w-4 h-4" />
          Estadísticas
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Recent findings */}
      <section>
        <div className={`${SECTION_HEADER} mb-2`}>
          <h2 className={SECTION_LABEL}>Casos recientes</h2>
          <Link to="/casos" className={SECTION_CTA}>
            Ver todos <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {error && (
          <div className="mx-4 sm:mx-0 bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm mt-3">
            Error al cargar los datos. Verifica tu conexión a Supabase.
          </div>
        )}

        <div className="divide-y divide-dark-700 sm:divide-y-0 sm:space-y-2 mt-2">
          {isLoading
            ? Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 px-4 py-3.5 sm:bg-dark-800 sm:border sm:border-dark-700 sm:rounded-xl sm:px-4 animate-pulse"
                >
                  <div className="w-0.5 self-stretch bg-dark-600 rounded-full shrink-0" />
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="h-4 bg-dark-700 rounded w-4/5" />
                    <div className="h-3 bg-dark-700 rounded w-2/5" />
                  </div>
                  <div className="h-5 bg-dark-700 rounded w-14 shrink-0" />
                </div>
              ))
            : recentFindings.map((finding) => (
                <RecentFindingRow key={finding.id} finding={finding} />
              ))}
        </div>
      </section>

      {/* Source note */}
      <section className="border-t border-dark-700 pt-5 px-4 sm:px-0">
        <p className="text-xs text-gray-600 text-center max-w-2xl mx-auto">
          Datos recopilados automáticamente de fuentes públicas y procesados con
          IA. No constituyen asesoría legal.{" "}
          <a
            href="https://ministeriopublico.gob.pa"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline"
          >
            Ministerio Público de Panamá
          </a>
          .
        </p>
      </section>
    </main>
  );
}

function WeeklyChart({ data }: { data: number[] }) {
  const max = Math.max(...data, 1);
  const H = 48;
  const n = data.length;
  const GAP = 3;
  const barW = (100 - GAP * (n - 1)) / n;

  return (
    <div className="px-4 sm:px-0">
      <svg
        viewBox={`0 0 100 ${H}`}
        className="w-full"
        style={{ height: H }}
        preserveAspectRatio="none"
      >
        {data.map((v, i) => {
          const barH = v > 0 ? Math.max((v / max) * H, 4) : 2;
          const x = i * (barW + GAP);
          const isRecent = i >= n - 2;
          return (
            <rect
              key={i}
              x={x}
              y={H - barH}
              width={barW}
              height={barH}
              rx="2"
              fill={isRecent ? "#34d399" : "rgba(255,255,255,0.08)"}
            />
          );
        })}
      </svg>
      <p className="text-xs text-gray-600 mt-1 px-0">
        Casos por semana · últimas {n} semanas
      </p>
    </div>
  );
}

function RecentFindingRow({ finding }: { finding: Finding }) {
  const date = finding.date_occurred ?? finding.date_reported;
  return (
    <Link
      to={`/casos/${finding.id}`}
      className="group flex items-center gap-3 px-4 py-3.5 hover:bg-dark-800/60 transition-colors sm:bg-dark-800 sm:border sm:border-dark-700 sm:rounded-xl sm:hover:border-dark-500"
      style={{
        borderLeftColor: SEVERITY_COLORS[finding.severity],
        borderLeftWidth: 3,
      }}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate group-hover:text-blue-300 transition-colors leading-snug">
          {finding.title}
        </p>
        <p className="text-xs text-gray-500 mt-0.5 truncate">
          {finding.category}
          {date ? ` · ${formatDate(date)}` : ""}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <SeverityBadge severity={finding.severity} size="sm" />
        <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-blue-400 transition-colors" />
      </div>
    </Link>
  );
}
