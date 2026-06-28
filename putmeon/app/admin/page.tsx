"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { AdminReport } from "@/lib/store";

const money = (n: number) => "R$ " + n.toFixed(3).replace(".", ",");
const pct = (n: number) => (n * 100).toFixed(0) + "%";

export default function AdminPage() {
  const [report, setReport] = useState<AdminReport | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const res = await fetch("/api/admin/report", { cache: "no-store" });
    setReport(await res.json());
    setLoading(false);
  };

  useEffect(() => {
    // Inline async fetch (sets state only after await) to avoid synchronous
    // setState in the effect body.
    void (async () => {
      const res = await fetch("/api/admin/report", { cache: "no-store" });
      setReport(await res.json());
      setLoading(false);
    })();
  }, []);

  return (
    <main className="shell flex flex-col">
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-line bg-bg/90 px-4 py-3 backdrop-blur">
        <Link href="/" aria-label="Voltar" className="-ml-1 text-ink/70">
          ←
        </Link>
        <span className="text-lg font-extrabold brand-text">Admin · Put Me On</span>
        <button
          onClick={load}
          className="ml-auto rounded-lg bg-white px-3 py-1.5 text-xs font-semibold ring-1 ring-line"
        >
          atualizar
        </button>
      </header>

      {loading || !report ? (
        <p className="p-6 text-sm text-muted">carregando…</p>
      ) : (
        <div className="flex flex-col gap-4 px-4 py-4">
          <section>
            <h2 className="mb-2 text-sm font-bold">North Star</h2>
            <div className="grid grid-cols-2 gap-2">
              <Stat
                label="Buscas com clique / buscas"
                value={pct(report.totals.north_star_click_rate)}
                hint={`meta ≥ 25% · ${report.totals.searches_with_click}/${report.totals.searches}`}
                good={report.totals.north_star_click_rate >= 0.25}
              />
              <Stat
                label="Margem por busca"
                value={money(report.economics.avg_margin_per_search)}
                hint="receita estimada − custo"
                good={report.economics.avg_margin_per_search >= 0}
              />
            </div>
          </section>

          <section>
            <h2 className="mb-2 text-sm font-bold">Produto</h2>
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Buscas" value={String(report.totals.searches)} />
              <Stat label="Cliques" value={String(report.totals.clicks)} />
              <Stat
                label="No-result rate"
                value={pct(report.totals.no_result_rate)}
                hint="meta < 40%"
                good={report.totals.no_result_rate < 0.4}
              />
              <Stat
                label="Feedback positivo"
                value={pct(report.totals.positive_feedback_rate)}
                hint={`${report.totals.feedback} respostas`}
              />
            </div>
          </section>

          <section>
            <h2 className="mb-2 text-sm font-bold">Economia por busca</h2>
            <div className="grid grid-cols-3 gap-2">
              <Stat label="Receita est." value={money(report.economics.avg_est_revenue_per_search)} />
              <Stat label="Custo (IA)" value={money(report.economics.avg_cost_per_search)} />
              <Stat
                label="Comissão total"
                value={"R$ " + report.economics.total_estimated_commission.toFixed(2)}
              />
            </div>
          </section>

          <Table
            title="Por categoria"
            head={["categoria", "buscas", "CTR", "no-result"]}
            rows={report.by_category.map((c) => [
              c.category,
              String(c.searches),
              pct(c.click_rate),
              pct(c.no_result_rate),
            ])}
          />

          <Table
            title="Receita por loja"
            head={["loja", "cliques", "comissão est."]}
            rows={report.by_store.map((s) => [
              s.store,
              String(s.clicks),
              "R$ " + s.estimated_commission.toFixed(2),
            ])}
          />

          <section>
            <h2 className="mb-2 text-sm font-bold">Buscas para revisar</h2>
            <p className="mb-2 text-xs text-muted">
              Sem resultado ou sem clique — candidatas a melhoria de catálogo.
            </p>
            <div className="space-y-2">
              {report.problem_searches.length === 0 && (
                <p className="rounded-xl bg-white p-3 text-sm text-muted ring-1 ring-line">
                  Nenhuma busca problemática ainda.
                </p>
              )}
              {report.problem_searches.map((s) => (
                <div
                  key={s.search_id}
                  className="rounded-xl bg-white p-3 text-xs ring-1 ring-line"
                >
                  <div className="flex justify-between font-semibold">
                    <span className="capitalize">
                      {s.category} · {s.subcategory}
                    </span>
                    <span className={s.no_results ? "text-red-600" : "text-amber-600"}>
                      {s.no_results ? "sem resultado" : "sem clique"}
                    </span>
                  </div>
                  <p className="mt-1 text-muted">
                    cor {s.primary_color} · {s.result_count} resultados · est.{" "}
                    {money(s.est_revenue_per_search)}/busca
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

function Stat({
  label,
  value,
  hint,
  good,
}: {
  label: string;
  value: string;
  hint?: string;
  good?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-white p-3 ring-1 ring-line">
      <p className="text-[11px] font-medium text-muted">{label}</p>
      <p
        className={`mt-1 text-xl font-extrabold ${
          good === undefined ? "" : good ? "text-good" : "text-red-600"
        }`}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 text-[10px] text-muted">{hint}</p>}
    </div>
  );
}

function Table({
  title,
  head,
  rows,
}: {
  title: string;
  head: string[];
  rows: string[][];
}) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-bold">{title}</h2>
      <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-line">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-line text-muted">
              {head.map((h) => (
                <th key={h} className="px-3 py-2 text-left font-medium capitalize">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={head.length} className="px-3 py-3 text-center text-muted">
                  sem dados
                </td>
              </tr>
            ) : (
              rows.map((r, i) => (
                <tr key={i} className="border-b border-line/60 last:border-0">
                  {r.map((c, j) => (
                    <td key={j} className="px-3 py-2 capitalize">
                      {c}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
