import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import {
  BarChart2,
  ExternalLink,
  Clock,
  CalendarDays,
  Calendar,
} from "lucide-react";
import { useDashboardStats } from "../hooks/useFindings";
import {
  SEVERITY_COLORS,
  SEVERITY_LABELS,
  CATEGORY_LABELS,
  formatMoney,
  truncate,
} from "../lib/utils";
import { type Severity } from "../types";

const SEVERITIES: Severity[] = ["critico", "alto", "medio", "bajo"];

// Panama cost benchmarks (USD) for equivalency comparisons
const HOSPITAL_ONCOLOGICO = 8_000_000;
const CASA_PROMEDIO = 65_000;
const PLANTA_DE_AGUA = 2_000_000;
const ESCUELA_PUBLICA = 2_400_000;

const SOURCES = [
  {
    name: "Fiscalía Anticorrupción",
    description:
      "Investigaciones penales activas contra funcionarios del Estado panameño.",
    url: "https://ministeriopublico.gob.pa",
  },
  {
    name: "Contraloría General de la República",
    description:
      "Auditorías e informes de irregularidades en el gasto público y contratos.",
    url: "https://www.contraloria.gob.pa",
  },
  {
    name: "Transparency International",
    description:
      "Índice de Percepción de la Corrupción (IPC) — metodología y datos históricos.",
    url: "https://www.transparency.org/en/cpi",
  },
  {
    name: "La Prensa de Panamá",
    description:
      "Cobertura periodística de investigaciones y juicios de corrupción.",
    url: "https://www.prensa.com",
  },
  {
    name: "SENNIAF",
    description:
      "Secretaría Nacional de Niñez, Adolescencia y Familia — reportes institucionales.",
    url: "https://www.senniaf.gob.pa",
  },
  {
    name: "Asamblea Nacional",
    description:
      "Debates legislativos, comisiones de investigación y declaraciones patrimoniales.",
    url: "https://www.asamblea.gob.pa",
  },
];

type TimeGranularity = "hora" | "dia" | "mes";

type Tab = "temporal" | "categorias" | "severidad" | "top10" | "fuentes";

const TABS: { id: Tab; label: string }[] = [
  { id: "temporal", label: "Casos en el tiempo" },
  { id: "categorias", label: "Monto por categoría" },
  { id: "severidad", label: "Distribución severidad" },
  { id: "top10", label: "Top 10 por monto" },
  { id: "fuentes", label: "Fuentes" },
];

// ── Custom tooltips ────────────────────────────────────────────────────────────

function AreaTip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-dark-800 border border-dark-600 rounded-lg px-3 py-2 text-sm">
      <p className="text-gray-400 text-xs mb-0.5">{label}</p>
      <p className="text-white font-semibold">{payload[0].value} casos</p>
    </div>
  );
}

function AmountTip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { value: number }[];
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-dark-800 border border-dark-600 rounded-lg px-3 py-2 text-sm">
      <p className="text-emerald-400 font-semibold">
        {formatMoney(payload[0].value)}
      </p>
    </div>
  );
}

function SeverityTip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { name: string; value: number; payload: { color: string } }[];
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div className="bg-dark-800 border border-dark-600 rounded-lg px-3 py-2 text-sm">
      <p style={{ color: d.payload.color }} className="font-semibold">
        {d.name}
      </p>
      <p className="text-white">{d.value} casos</p>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function rawMoney(amount: number): string {
  return "$" + Math.round(amount).toLocaleString("en-US");
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function Estadisticas() {
  const navigate = useNavigate();
  const { data: stats, isLoading } = useDashboardStats();
  const [activeTab, setActiveTab] = useState<Tab>("temporal");
  const [granularity, setGranularity] = useState<TimeGranularity>("dia");

  const all = stats?.recent_findings ?? [];

  // ── Data derivations ──────────────────────────────────────────────────────

  const findingsByTime = useMemo(() => {
    const map: Record<string, number> = {};
    all.forEach((f) => {
      let key: string;
      if (granularity === "mes") {
        key = f.created_at.slice(0, 7);
      } else if (granularity === "dia") {
        key = f.created_at.slice(0, 10);
      } else {
        key = f.created_at.slice(0, 13);
      }
      map[key] = (map[key] || 0) + 1;
    });

    const entries = Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
    const limited =
      granularity === "hora"
        ? entries.slice(-7 * 24)
        : granularity === "dia"
          ? entries.slice(-90)
          : entries.slice(-24);

    return limited.map(([key, count]) => {
      let label: string;
      if (granularity === "mes") {
        label = new Date(key + "-01").toLocaleDateString("es-PA", {
          month: "short",
          year: "2-digit",
        });
      } else if (granularity === "dia") {
        label = new Date(key + "T00:00:00").toLocaleDateString("es-PA", {
          day: "numeric",
          month: "short",
        });
      } else {
        const hour = key.slice(11, 13);
        const day = new Date(key.slice(0, 10) + "T00:00:00").toLocaleDateString(
          "es-PA",
          { day: "numeric", month: "short" },
        );
        label = `${day} ${hour}h`;
      }
      return { label, count };
    });
  }, [all, granularity]);

  const amountByCategory = useMemo(
    () =>
      Object.entries(
        all.reduce(
          (acc, f) => {
            if (f.amount_usd)
              acc[f.category] = (acc[f.category] || 0) + f.amount_usd;
            return acc;
          },
          {} as Record<string, number>,
        ),
      )
        .map(([cat, amount]) => ({ name: CATEGORY_LABELS[cat] ?? cat, amount }))
        .sort((a, b) => b.amount - a.amount),
    [all],
  );

  const severityData = useMemo(
    () =>
      SEVERITIES.map((sev) => ({
        name: SEVERITY_LABELS[sev],
        value: stats?.by_severity[sev] ?? 0,
        color: SEVERITY_COLORS[sev],
      })),
    [stats],
  );

  const top10 = useMemo(
    () =>
      all
        .filter((f) => f.amount_usd)
        .sort((a, b) => (b.amount_usd ?? 0) - (a.amount_usd ?? 0))
        .slice(0, 10)
        .map((f) => ({
          id: f.id,
          title: truncate(f.title, 40),
          amount: f.amount_usd!,
          color: SEVERITY_COLORS[f.severity],
        })),
    [all],
  );

  const totalAmount = stats?.total_amount_usd ?? 0;
  const equivalencies = useMemo(() => {
    if (!totalAmount) return null;
    return {
      hospitales: Math.floor(totalAmount / HOSPITAL_ONCOLOGICO),
      casas: Math.floor(totalAmount / CASA_PROMEDIO),
      plantas: Math.floor(totalAmount / PLANTA_DE_AGUA),
      escuelas: Math.floor(totalAmount / ESCUELA_PUBLICA),
    };
  }, [totalAmount]);

  const skeleton = (
    <div className="h-64 bg-dark-700 rounded-xl animate-pulse" />
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)]">
      {/* ── Persistent: Fondos comprometidos ─────────────────────────────── */}
      <div className="border-b border-dark-700 bg-dark-900 px-4 sm:px-6 lg:px-8 py-5">
        {isLoading ? (
          <div className="h-12 w-64 bg-dark-700 rounded-lg animate-pulse" />
        ) : (
          <>
            <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">
              Fondos comprometidos
            </p>
            <p className="text-3xl sm:text-4xl font-bold font-mono text-emerald-400 break-all">
              {rawMoney(totalAmount)}
            </p>
            {equivalencies && totalAmount > 0 && (
              <p className="text-sm text-gray-400 leading-relaxed mt-3 max-w-4xl">
                Equivale a{" "}
                <span className="text-white font-semibold">
                  {equivalencies.hospitales.toLocaleString("en-US")}
                </span>{" "}
                {equivalencies.hospitales === 1
                  ? "hospital oncológico"
                  : "hospitales oncológicos"}
                ,{" "}
                <span className="text-white font-semibold">
                  {equivalencies.casas.toLocaleString("en-US")}
                </span>{" "}
                {equivalencies.casas === 1 ? "vivienda" : "viviendas"} para
                familias panameñas,{" "}
                <span className="text-white font-semibold">
                  {equivalencies.plantas.toLocaleString("en-US")}
                </span>{" "}
                {equivalencies.plantas === 1
                  ? "planta de tratamiento de agua"
                  : "plantas de tratamiento de agua"}
                , o{" "}
                <span className="text-white font-semibold">
                  {equivalencies.escuelas.toLocaleString("en-US")}
                </span>{" "}
                {equivalencies.escuelas === 1
                  ? "escuela pública"
                  : "escuelas públicas"}
                .
              </p>
            )}
          </>
        )}
      </div>

      <div className="flex flex-col lg:flex-row flex-1">
        {/* ── Sidebar navigation ───────────────────────────────────────────── */}
        <nav className="lg:w-56 lg:flex-shrink-0 lg:border-r border-dark-700 bg-dark-900">
          {/* Mobile: horizontal scroll */}
          <div className="flex lg:flex-col overflow-x-auto lg:overflow-x-visible gap-1 p-2 lg:p-3 lg:pt-6">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                flex-shrink-0 lg:flex-shrink text-left px-3 py-2 rounded-lg text-sm transition-colors whitespace-nowrap lg:whitespace-normal w-auto lg:w-full
                ${
                  activeTab === tab.id
                    ? "bg-blue-600/20 text-blue-300 font-medium"
                    : "text-gray-400 hover:text-white hover:bg-dark-700"
                }
              `}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </nav>

        {/* ── Chart content ────────────────────────────────────────────────── */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <BarChart2 className="w-6 h-6 text-blue-400 flex-shrink-0" />
              {TABS.find((t) => t.id === activeTab)?.label}
            </h1>
            {activeTab !== "fuentes" && (
              <p className="text-gray-500 text-sm mt-1">
                {stats?.total_findings ?? "…"} casos documentados
              </p>
            )}
          </div>

          {/* ── Tab: Hallazgos temporales ─────────────────────────────────── */}
          {activeTab === "temporal" && (
            <div className="space-y-4">
              {/* Granularity toggle */}
              <div className="flex items-center gap-2">
                {(
                  [
                    { id: "hora", label: "Por hora", Icon: Clock },
                    { id: "dia", label: "Por día", Icon: CalendarDays },
                    { id: "mes", label: "Por mes", Icon: Calendar },
                  ] as {
                    id: TimeGranularity;
                    label: string;
                    Icon: typeof Clock;
                  }[]
                ).map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    onClick={() => setGranularity(id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      granularity === id
                        ? "bg-blue-600 text-white"
                        : "bg-dark-800 text-gray-400 hover:text-white border border-dark-700"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                  </button>
                ))}
              </div>

              {isLoading ? (
                skeleton
              ) : (
                <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
                  <ResponsiveContainer width="100%" height={380}>
                    <AreaChart
                      data={findingsByTime}
                      margin={{ top: 4, right: 16, bottom: 24, left: 0 }}
                    >
                      <defs>
                        <linearGradient
                          id="areaGrad"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#3b82f6"
                            stopOpacity={0.3}
                          />
                          <stop
                            offset="95%"
                            stopColor="#3b82f6"
                            stopOpacity={0}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#1f2937"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="label"
                        tick={{ fill: "#9ca3af", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        interval="preserveStartEnd"
                        angle={-35}
                        textAnchor="end"
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fill: "#9ca3af", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        content={<AreaTip />}
                        cursor={{ stroke: "#374151" }}
                      />
                      <Area
                        type="monotone"
                        dataKey="count"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        fill="url(#areaGrad)"
                        dot={false}
                        activeDot={{
                          r: 4,
                          fill: "#3b82f6",
                          stroke: "#1e3a5f",
                          strokeWidth: 2,
                        }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {/* ── Tab: Monto por categoría ──────────────────────────────────── */}
          {activeTab === "categorias" && (
            <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
              {isLoading ? (
                skeleton
              ) : amountByCategory.length === 0 ? (
                <p className="text-gray-500 text-sm">
                  Sin datos de montos disponibles.
                </p>
              ) : (
                <ResponsiveContainer
                  width="100%"
                  height={Math.max(320, amountByCategory.length * 52)}
                >
                  <BarChart
                    layout="vertical"
                    data={amountByCategory}
                    margin={{ top: 0, right: 16, bottom: 0, left: 8 }}
                  >
                    <XAxis
                      type="number"
                      tick={{ fill: "#9ca3af", fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => formatMoney(v)}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={140}
                      tick={{ fill: "#d1d5db", fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      content={<AmountTip />}
                      cursor={{ fill: "#1f2937" }}
                    />
                    <Bar dataKey="amount" radius={[0, 4, 4, 0]} barSize={28}>
                      {amountByCategory.map((_, i) => (
                        <Cell
                          key={i}
                          fill={`hsl(${210 + i * 14}, 68%, ${58 - i * 2}%)`}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          )}

          {/* ── Tab: Distribución severidad ───────────────────────────────── */}
          {activeTab === "severidad" && (
            <div className="bg-dark-800 border border-dark-700 rounded-xl p-6 max-w-xl">
              {isLoading ? (
                skeleton
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={severityData}
                        cx="50%"
                        cy="50%"
                        innerRadius={80}
                        outerRadius={120}
                        dataKey="value"
                        paddingAngle={3}
                      >
                        {severityData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<SeverityTip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    {severityData.map((s) => (
                      <div
                        key={s.name}
                        className="flex items-center gap-2 bg-dark-700 rounded-lg px-3 py-2"
                      >
                        <span
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: s.color }}
                        />
                        <span className="text-sm text-gray-300">{s.name}</span>
                        <span className="text-sm font-bold text-white ml-auto">
                          {s.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Tab: Top 10 por monto ──────────────────────────────────────── */}
          {activeTab === "top10" && (
            <div className="bg-dark-800 border border-dark-700 rounded-xl p-6">
              {isLoading ? (
                skeleton
              ) : top10.length === 0 ? (
                <p className="text-gray-500 text-sm">
                  Sin datos de montos disponibles.
                </p>
              ) : (
                <>
                  <ResponsiveContainer
                    width="100%"
                    height={Math.max(360, top10.length * 46)}
                  >
                    <BarChart
                      layout="vertical"
                      data={top10}
                      margin={{ top: 0, right: 16, bottom: 0, left: 8 }}
                      onClick={({ activePayload }) => {
                        const id = activePayload?.[0]?.payload?.id;
                        if (id) navigate(`/casos/${id}`);
                      }}
                    >
                      <XAxis
                        type="number"
                        tick={{ fill: "#9ca3af", fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v) => formatMoney(v)}
                      />
                      <YAxis
                        type="category"
                        dataKey="title"
                        width={200}
                        tick={{ fill: "#d1d5db", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        content={<AmountTip />}
                        cursor={{ fill: "#1f2937" }}
                      />
                      <Bar
                        dataKey="amount"
                        radius={[0, 4, 4, 0]}
                        barSize={28}
                        style={{ cursor: "pointer" }}
                      >
                        {top10.map((entry, i) => (
                          <Cell key={i} fill={entry.color} fillOpacity={0.85} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <p className="text-xs text-gray-600 mt-3">
                    Haz clic en una barra para ver el caso completo.
                  </p>
                </>
              )}
            </div>
          )}

          {/* ── Tab: Fuentes ──────────────────────────────────────────────── */}
          {activeTab === "fuentes" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {SOURCES.map((src) => (
                <a
                  key={src.name}
                  href={src.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group bg-dark-800 border border-dark-700 hover:border-dark-500 rounded-xl p-4 transition-colors flex flex-col gap-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-semibold text-white group-hover:text-blue-300 transition-colors leading-snug">
                      {src.name}
                    </p>
                    <ExternalLink className="w-3.5 h-3.5 text-gray-600 group-hover:text-blue-400 flex-shrink-0 mt-0.5 transition-colors" />
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">
                    {src.description}
                  </p>
                </a>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
