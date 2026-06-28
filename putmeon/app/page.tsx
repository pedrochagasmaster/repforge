"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import type {
  AnalyzeResponse,
  Attributes,
  DetectedItem,
  ScoredProduct,
  SearchResult,
} from "@/lib/types";
import { ProductThumb } from "./components/ProductThumb";

type Step = "home" | "analyzing" | "select" | "searching" | "results";
type Bucket = "similar" | "cheap" | "value";

const money = (n: number) =>
  "R$ " + n.toFixed(2).replace(".", ",");
const pct = (n: number) => Math.round(n * 100) + "%";

export default function Home() {
  const [step, setStep] = useState<Step>("home");
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalyzeResponse | null>(null);
  const [selected, setSelected] = useState<DetectedItem | null>(null);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [bucket, setBucket] = useState<Bucket>("similar");
  const [maxPrice, setMaxPrice] = useState<number>(0);
  const [cropMode, setCropMode] = useState(false);
  const [feedback, setFeedback] = useState<null | "looks_like" | "not_like">(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep("home");
    setAnalysis(null);
    setSelected(null);
    setResult(null);
    setError(null);
    setCropMode(false);
    setFeedback(null);
  };

  const analyze = useCallback(async (file: File) => {
    setError(null);
    setStep("analyzing");
    try {
      const fd = new FormData();
      fd.append("image", file);
      const res = await fetch("/api/analyze", { method: "POST", body: fd });
      const data = (await res.json()) as AnalyzeResponse & { error?: string };
      if (!res.ok) throw new Error(data.error || "falha ao analisar");
      setAnalysis(data);
      setStep("select");
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
      setStep("home");
    }
  }, []);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) void analyze(f);
  };

  const useSample = async () => {
    setStep("analyzing");
    const res = await fetch("/sample_look.jpg");
    const blob = await res.blob();
    void analyze(new File([blob], "sample_look.jpg", { type: "image/jpeg" }));
  };

  const search = useCallback(
    async (item: Attributes) => {
      setStep("searching");
      setFeedback(null);
      try {
        const res = await fetch("/api/search", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ item, upload_id: analysis?.upload_id }),
        });
        const data = (await res.json()) as SearchResult & { error?: string };
        if (!res.ok) throw new Error(data.error || "falha na busca");
        setResult(data);
        const max = Math.max(
          0,
          ...data.most_similar.map((s) => s.product.price),
          ...data.cheapest.map((s) => s.product.price),
        );
        setMaxPrice(Math.ceil(max));
        setBucket("similar");
        setStep("results");
      } catch (e) {
        setError(String(e instanceof Error ? e.message : e));
        setStep("select");
      }
    },
    [analysis],
  );

  const pickItem = (item: DetectedItem) => {
    setSelected(item);
    void search(item);
  };

  const onCropConfirm = async (region: [number, number, number, number]) => {
    if (!analysis) return;
    setCropMode(false);
    setStep("searching");
    try {
      const res = await fetch("/api/crop", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ upload_id: analysis.upload_id, region }),
      });
      const data = (await res.json()) as { item?: DetectedItem; error?: string };
      if (!res.ok || !data.item) throw new Error(data.error || "falha ao recortar");
      setSelected(data.item);
      void search(data.item);
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
      setStep("select");
    }
  };

  return (
    <main className="shell flex flex-col">
      <TopBar step={step} onBack={reset} />

      {error && (
        <div className="mx-4 mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 ring-1 ring-red-100">
          {error}
        </div>
      )}

      {step === "home" && (
        <Landing onPick={() => fileRef.current?.click()} onSample={useSample} />
      )}

      {step === "analyzing" && (
        <Loader
          title="Lendo seu print…"
          subtitle="A IA está detectando as peças do look. Leva alguns segundos."
        />
      )}

      {step === "select" && analysis && (
        <SelectStep
          analysis={analysis}
          cropMode={cropMode}
          onToggleCrop={() => setCropMode((v) => !v)}
          onPick={pickItem}
          onCropConfirm={onCropConfirm}
        />
      )}

      {step === "searching" && (
        <Loader
          title="Procurando dupes…"
          subtitle="Rankeando por similaridade, preço e disponibilidade no Brasil."
        />
      )}

      {step === "results" && result && selected && (
        <Results
          result={result}
          selected={selected}
          bucket={bucket}
          setBucket={setBucket}
          maxPrice={maxPrice}
          setMaxPrice={setMaxPrice}
          feedback={feedback}
          setFeedback={setFeedback}
          onNew={reset}
        />
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={onFile}
      />
    </main>
  );
}

function TopBar({ step, onBack }: { step: Step; onBack: () => void }) {
  return (
    <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-line bg-bg/90 px-4 py-3 backdrop-blur">
      {step !== "home" && (
        <button
          onClick={onBack}
          aria-label="Voltar"
          className="-ml-1 grid h-8 w-8 place-items-center rounded-full text-ink/70 hover:bg-line"
        >
          ←
        </button>
      )}
      <div className="flex items-baseline gap-1">
        <span className="text-lg font-extrabold tracking-tight brand-text">Put Me On</span>
      </div>
      <Link
        href="/admin"
        className="ml-auto text-xs font-medium text-muted hover:text-ink"
      >
        admin
      </Link>
    </header>
  );
}

function Landing({
  onPick,
  onSample,
}: {
  onPick: () => void;
  onSample: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col px-5 pb-10 pt-6">
      <div className="brand-gradient rounded-3xl p-6 text-white shadow-lg">
        <p className="text-sm/5 font-medium opacity-90">moda · dupes · Brasil</p>
        <h1 className="mt-2 text-3xl font-extrabold leading-tight">
          Ache o look do print, pagando menos.
        </h1>
        <p className="mt-3 text-sm/6 opacity-95">
          Suba um print de Instagram, TikTok ou Pinterest, escolha a peça e
          receba opções parecidas, compráveis e mais baratas.
        </p>
      </div>

      <button
        onClick={onPick}
        className="mt-6 w-full rounded-2xl bg-ink py-4 text-center text-base font-semibold text-white active:scale-[0.99]"
      >
        Subir print
      </button>
      <button
        onClick={onSample}
        className="mt-3 w-full rounded-2xl bg-white py-4 text-center text-base font-semibold text-ink ring-1 ring-line active:scale-[0.99]"
      >
        Usar print de exemplo
      </button>

      <ol className="mt-8 space-y-3 text-sm text-ink/80">
        {[
          "Suba o print do look que você curtiu.",
          "Toque na peça que você quer encontrar.",
          "Veja versões parecidas e mais baratas e compre.",
        ].map((t, i) => (
          <li key={i} className="flex gap-3">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-accent/10 text-xs font-bold text-accent">
              {i + 1}
            </span>
            {t}
          </li>
        ))}
      </ol>

      <div className="mt-auto pt-8">
        <Disclosure />
      </div>
    </div>
  );
}

function Disclosure() {
  return (
    <p className="text-[11px] leading-4 text-muted">
      Podemos receber comissão se você comprar por estes links, sem custo extra
      para você. As imagens enviadas são usadas só para a busca, não fazemos
      reconhecimento facial e o print original é apagado em 24h.
    </p>
  );
}

function Loader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-line border-t-accent" />
      <h2 className="mt-5 text-lg font-bold">{title}</h2>
      <p className="mt-1 text-sm text-muted">{subtitle}</p>
    </div>
  );
}

function SelectStep({
  analysis,
  cropMode,
  onToggleCrop,
  onPick,
  onCropConfirm,
}: {
  analysis: AnalyzeResponse;
  cropMode: boolean;
  onToggleCrop: () => void;
  onPick: (item: DetectedItem) => void;
  onCropConfirm: (region: [number, number, number, number]) => void;
}) {
  return (
    <div className="flex flex-1 flex-col px-4 pb-8 pt-4">
      <h2 className="text-lg font-bold">
        {cropMode ? "Recorte a peça" : "Toque na peça que você quer"}
      </h2>
      <p className="mt-0.5 text-sm text-muted">
        {cropMode
          ? "Arraste para selecionar a área da peça."
          : analysis.fallback
            ? "Não detectei peças automaticamente — use o recorte manual."
            : `${analysis.items.length} peça(s) detectada(s) em ${(analysis.ms / 1000).toFixed(1)}s.`}
      </p>

      <ImageCanvas
        analysis={analysis}
        cropMode={cropMode}
        onPick={onPick}
        onCropConfirm={onCropConfirm}
      />

      {!cropMode && (
        <div className="mt-3 space-y-2">
          {analysis.items.map((it) => (
            <button
              key={it.item_id}
              onClick={() => onPick(it)}
              className="flex w-full items-center gap-3 rounded-2xl bg-white p-3 text-left ring-1 ring-line active:scale-[0.99]"
            >
              <span
                className="h-10 w-10 shrink-0 rounded-lg ring-1 ring-black/10"
                style={{ background: it.color_hex }}
              />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold capitalize">
                  {it.subcategory || it.label_pt}
                </span>
                <span className="block truncate text-xs text-muted">
                  {it.primary_color} · {it.fit} · {pct(it.confidence)} confiança
                </span>
              </span>
              <span className="text-accent">→</span>
            </button>
          ))}
        </div>
      )}

      <button
        onClick={onToggleCrop}
        className="mt-4 w-full rounded-2xl bg-white py-3 text-center text-sm font-semibold text-ink ring-1 ring-line"
      >
        {cropMode ? "Cancelar recorte" : "Recortar manualmente"}
      </button>
    </div>
  );
}

function ImageCanvas({
  analysis,
  cropMode,
  onPick,
  onCropConfirm,
}: {
  analysis: AnalyzeResponse;
  cropMode: boolean;
  onPick: (item: DetectedItem) => void;
  onCropConfirm: (region: [number, number, number, number]) => void;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  } | null>(null);

  const toFrac = (clientX: number, clientY: number) => {
    const r = boxRef.current!.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (clientY - r.top) / r.height)),
    };
  };

  const rect = drag
    ? {
        left: Math.min(drag.x0, drag.x1),
        top: Math.min(drag.y0, drag.y1),
        w: Math.abs(drag.x1 - drag.x0),
        h: Math.abs(drag.y1 - drag.y0),
      }
    : null;

  return (
    <div className="mt-3">
      <div
        ref={boxRef}
        className="relative overflow-hidden rounded-2xl bg-black/5 ring-1 ring-line select-none touch-none"
        onPointerDown={(e) => {
          if (!cropMode) return;
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          const p = toFrac(e.clientX, e.clientY);
          setDrag({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
        }}
        onPointerMove={(e) => {
          if (!cropMode || !drag) return;
          const p = toFrac(e.clientX, e.clientY);
          setDrag((d) => (d ? { ...d, x1: p.x, y1: p.y } : d));
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={analysis.image_data_url}
          alt="print enviado"
          className="block w-full"
          draggable={false}
        />

        {!cropMode &&
          analysis.items.map((it) => (
            <button
              key={it.item_id}
              onClick={() => onPick(it)}
              aria-label={it.label_pt}
              className="absolute rounded-lg border-2 border-white/90 bg-accent/15 shadow-[0_0_0_2px_rgba(232,85,61,0.6)]"
              style={{
                left: `${it.bbox[0] * 100}%`,
                top: `${it.bbox[1] * 100}%`,
                width: `${it.bbox[2] * 100}%`,
                height: `${it.bbox[3] * 100}%`,
              }}
            >
              <span className="absolute -top-2 left-1 rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-white capitalize">
                {it.label_pt}
              </span>
            </button>
          ))}

        {cropMode && rect && (
          <div
            className="absolute border-2 border-accent bg-accent/15"
            style={{
              left: `${rect.left * 100}%`,
              top: `${rect.top * 100}%`,
              width: `${rect.w * 100}%`,
              height: `${rect.h * 100}%`,
            }}
          />
        )}
      </div>

      {cropMode && (
        <button
          disabled={!rect || rect.w < 0.04 || rect.h < 0.04}
          onClick={() =>
            rect && onCropConfirm([rect.left, rect.top, rect.w, rect.h])
          }
          className="mt-3 w-full rounded-2xl bg-accent py-3 text-center text-sm font-semibold text-white disabled:opacity-40"
        >
          Buscar esta peça
        </button>
      )}
    </div>
  );
}

function Results({
  result,
  selected,
  bucket,
  setBucket,
  maxPrice,
  setMaxPrice,
  feedback,
  setFeedback,
  onNew,
}: {
  result: SearchResult;
  selected: DetectedItem;
  bucket: Bucket;
  setBucket: (b: Bucket) => void;
  maxPrice: number;
  setMaxPrice: (n: number) => void;
  feedback: null | "looks_like" | "not_like";
  setFeedback: (v: "looks_like" | "not_like") => void;
  onNew: () => void;
}) {
  const list =
    bucket === "similar"
      ? result.most_similar
      : bucket === "cheap"
        ? result.cheapest
        : result.best_value;
  const filtered = list.filter((s) => s.product.price <= maxPrice || maxPrice === 0);

  const sliderMax = Math.max(
    1,
    ...result.most_similar.map((s) => s.product.price),
    ...result.cheapest.map((s) => s.product.price),
  );
  const cheapestPrice = result.cheapest[0]?.product.price;

  const sendFeedback = async (value: "looks_like" | "not_like") => {
    setFeedback(value);
    await fetch("/api/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ search_id: result.search_id, value }),
    });
  };

  if (result.no_results) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
        <h2 className="text-lg font-bold">Sem resultados ainda</h2>
        <p className="mt-1 text-sm text-muted">
          Ainda não temos peças dessa categoria no catálogo. Já registramos sua
          busca para priorizar.
        </p>
        <button
          onClick={onNew}
          className="mt-6 rounded-2xl bg-ink px-6 py-3 text-sm font-semibold text-white"
        >
          Tentar outro print
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col px-4 pb-10 pt-3">
      <div className="flex items-center gap-3 rounded-2xl bg-white p-3 ring-1 ring-line">
        <span
          className="h-9 w-9 shrink-0 rounded-lg ring-1 ring-black/10"
          style={{ background: selected.color_hex }}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold capitalize">
            {selected.subcategory || selected.label_pt}
          </p>
          <p className="text-xs text-muted">
            estimativa do original ~ {money(result.estimated_price)}
          </p>
        </div>
        {cheapestPrice !== undefined && (
          <div className="rounded-lg bg-good/10 px-2 py-1 text-right">
            <p className="text-[10px] font-medium text-good">a partir de</p>
            <p className="text-sm font-extrabold text-good">{money(cheapestPrice)}</p>
          </div>
        )}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-1 rounded-2xl bg-line/60 p-1 text-xs font-semibold">
        {(
          [
            ["similar", "Mais parecido"],
            ["cheap", "Mais barato"],
            ["value", "Custo-benefício"],
          ] as [Bucket, string][]
        ).map(([b, label]) => (
          <button
            key={b}
            onClick={() => setBucket(b)}
            className={`rounded-xl py-2 ${
              bucket === b ? "bg-white text-ink shadow-sm" : "text-muted"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-3">
        <span className="text-xs text-muted">até</span>
        <input
          type="range"
          min={Math.floor(
            Math.min(...result.cheapest.map((s) => s.product.price)),
          )}
          max={Math.ceil(sliderMax)}
          value={maxPrice}
          onChange={(e) => setMaxPrice(Number(e.target.value))}
          className="flex-1 accent-accent"
        />
        <span className="w-20 text-right text-xs font-semibold">{money(maxPrice)}</span>
      </div>

      {result.sponsored.length > 0 && (
        <div className="mt-3">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">
            Patrocinado
          </p>
          {result.sponsored.map((s) => (
            <ProductCard
              key={s.product.id}
              s={s}
              searchId={result.search_id}
              bucket="sponsored"
              rank={0}
              estimated={result.estimated_price}
            />
          ))}
        </div>
      )}

      <div className="mt-3 space-y-2">
        {filtered.length === 0 && (
          <p className="rounded-xl bg-white p-4 text-center text-sm text-muted ring-1 ring-line">
            Nenhuma peça abaixo de {money(maxPrice)}. Aumente o limite.
          </p>
        )}
        {filtered.map((s, i) => (
          <ProductCard
            key={s.product.id}
            s={s}
            searchId={result.search_id}
            bucket={bucket}
            rank={i + 1}
            estimated={result.estimated_price}
          />
        ))}
      </div>

      <div className="mt-5 rounded-2xl bg-white p-4 ring-1 ring-line">
        <p className="text-sm font-semibold">Esses resultados parecem com o print?</p>
        {feedback ? (
          <p className="mt-2 text-sm text-good">Valeu! Feedback registrado.</p>
        ) : (
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => sendFeedback("looks_like")}
              className="flex-1 rounded-xl bg-good/10 py-2 text-sm font-semibold text-good"
            >
              👍 Parece
            </button>
            <button
              onClick={() => sendFeedback("not_like")}
              className="flex-1 rounded-xl bg-line py-2 text-sm font-semibold text-ink/70"
            >
              👎 Não parece
            </button>
          </div>
        )}
      </div>

      <button
        onClick={onNew}
        className="mt-4 w-full rounded-2xl bg-ink py-3 text-sm font-semibold text-white"
      >
        Buscar outro print
      </button>
      <div className="mt-4">
        <Disclosure />
      </div>
    </div>
  );
}

function ProductCard({
  s,
  searchId,
  bucket,
  rank,
  estimated,
}: {
  s: ScoredProduct;
  searchId: string;
  bucket: string;
  rank: number;
  estimated: number;
}) {
  const [loading, setLoading] = useState(false);
  const p = s.product;

  const open = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/track", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          search_id: searchId,
          product_id: p.id,
          bucket,
          rank,
        }),
      });
      const data = (await res.json()) as { affiliate_url?: string };
      window.open(data.affiliate_url || p.product_url, "_blank", "noopener");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex gap-3 rounded-2xl bg-white p-3 ring-1 ring-line">
      <ProductThumb
        category={p.category}
        colorHex={p.color_hex}
        className="h-24 w-20 shrink-0 rounded-xl ring-1 ring-black/5"
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start gap-2">
          <p className="min-w-0 flex-1 text-sm font-semibold leading-snug">{p.title}</p>
          {p.sponsored && (
            <span className="shrink-0 rounded bg-line px-1.5 py-0.5 text-[9px] font-bold uppercase text-muted">
              Patroc.
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-muted">
          {p.brand} · {p.store}
        </p>

        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold text-accent">
            {pct(s.visual_similarity)} parecido
          </span>
          {s.savings > 0 && (
            <span className="rounded-full bg-good/10 px-2 py-0.5 text-[10px] font-semibold text-good">
              economize {money(s.savings)}
            </span>
          )}
          {!p.available && (
            <span className="rounded-full bg-line px-2 py-0.5 text-[10px] font-semibold text-muted">
              indisponível
            </span>
          )}
        </div>

        <div className="mt-auto flex items-end justify-between pt-2">
          <div>
            <p className="text-base font-extrabold">{money(p.price)}</p>
            {estimated > p.price && (
              <p className="text-[10px] text-muted line-through">{money(estimated)}</p>
            )}
          </div>
          <button
            onClick={open}
            disabled={loading}
            className="rounded-xl bg-ink px-4 py-2 text-xs font-semibold text-white active:scale-95 disabled:opacity-50"
          >
            {loading ? "abrindo…" : "Ver na loja"}
          </button>
        </div>
      </div>
    </div>
  );
}
