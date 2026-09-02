# import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Package, TrendingUp, Upload, Plus, Trash2, Pencil, AlertTriangle,
  BarChart3, Boxes, Receipt, X, Search, Download, ChevronRight
} from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar
} from "recharts";
import Papa from "papaparse";

// ---------- storage helpers ----------
const PRODUCTS_KEY = "sedori:products";
const SALES_KEY = "sedori:sales";

async function loadKey(key, fallback) {
  try {
    const res = await window.storage.get(key, false);
    return res ? JSON.parse(res.value) : fallback;
  } catch {
    return fallback;
  }
}
async function saveKey(key, value) {
  try {
    await window.storage.set(key, JSON.stringify(value), false);
  } catch (e) {
    console.error("storage save failed", key, e);
  }
}

const uid = () => Math.random().toString(36).slice(2, 10);
const yen = (n) =>
  "¥" + Math.round(n || 0).toLocaleString("ja-JP");
const todayStr = () => new Date().toISOString().slice(0, 10);

// ---------- demo seed (only used if storage empty) ----------
const seedProducts = [
  { id: uid(), sku: "SED-0001", asin: "B0C1XJ8Q2P", name: "ワイヤレスイヤホン Type-C", category: "家電", purchasePrice: 2400, currentStock: 6, reorderPoint: 3, createdAt: todayStr() },
  { id: uid(), sku: "SED-0002", asin: "B09KJ3M441", name: "折りたたみ傘 軽量カーボン", category: "生活雑貨", purchasePrice: 850, currentStock: 2, reorderPoint: 4, createdAt: todayStr() },
  { id: uid(), sku: "SED-0003", asin: "B0B7YX9L3T", name: "スマホスタンド 卓上", category: "家電", purchasePrice: 480, currentStock: 12, reorderPoint: 5, createdAt: todayStr() },
];

function Stamp({ children, tone = "ink" }) {
  const tones = {
    ink: "border-[#1E2A4A] text-[#1E2A4A]",
    amber: "border-[#B7791F] text-[#B7791F]",
    green: "border-[#2F6F4E] text-[#2F6F4E]",
    red: "border-[#B0362C] text-[#B0362C]",
  };
  return (
    <span className={`inline-flex items-center gap-1 border-2 rounded-sm px-2 py-0.5 text-[11px] font-bold tracking-widest uppercase ${tones[tone]}`}
      style={{ transform: "rotate(-1.5deg)" }}>
      {children}
    </span>
  );
}

function Card({ children, className = "" }) {
  return (
    <div className={`bg-[#FCFBF7] border border-[#E4E0D4] rounded-md shadow-[0_1px_0_#00000008] ${className}`}>
      {children}
    </div>
  );
}

function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className={`bg-[#FCFBF7] rounded-md border border-[#D8D3C3] w-full ${wide ? "max-w-2xl" : "max-w-md"} max-h-[85vh] overflow-y-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E4E0D4]">
          <h3 className="font-bold text-[#1E2A4A] tracking-wide">{title}</h3>
          <button onClick={onClose} className="text-[#8A8471] hover:text-[#1E2A4A]">
            <X size={18} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block mb-3">
      <span className="block text-[11px] font-bold tracking-widest uppercase text-[#8A8471] mb-1">{label}</span>
      {children}
    </label>
  );
}

const inputCls =
  "w-full bg-white border border-[#D8D3C3] rounded-sm px-3 py-2 text-sm text-[#1E2A4A] focus:outline-none focus:ring-2 focus:ring-[#1E2A4A]/30 font-mono";

export default function SedoriManager() {
  const [tab, setTab] = useState("dashboard");
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [productModal, setProductModal] = useState(null); // null | {} | product
  const [saleModal, setSaleModal] = useState(null);
  const [csvOpen, setCsvOpen] = useState(false);
  const [query, setQuery] = useState("");
  const fileInputRef = useRef(null);

  useEffect(() => {
    (async () => {
      const p = await loadKey(PRODUCTS_KEY, null);
      const s = await loadKey(SALES_KEY, null);
      setProducts(p ?? seedProducts);
      setSales(s ?? []);
      setLoaded(true);
    })();
  }, []);

  useEffect(() => { if (loaded) saveKey(PRODUCTS_KEY, products); }, [products, loaded]);
  useEffect(() => { if (loaded) saveKey(SALES_KEY, sales); }, [sales, loaded]);

  const productMap = useMemo(() => Object.fromEntries(products.map(p => [p.id, p])), [products]);

  const enrichedSales = useMemo(() => sales.map(s => {
    const p = productMap[s.productId];
    const cost = (p?.purchasePrice ?? 0) * s.quantity;
    const revenue = s.salePrice * s.quantity;
    const fees = (s.amazonFee ?? 0) + (s.shippingCost ?? 0);
    const profit = revenue - cost - fees;
    return { ...s, product: p, cost, revenue, fees, profit };
  }), [productMap, sales]);

  const thisMonthSales = useMemo(() => {
    const ym = todayStr().slice(0, 7);
    return enrichedSales.filter(s => s.saleDate?.slice(0, 7) === ym);
  }, [enrichedSales]);

  const monthRevenue = thisMonthSales.reduce((a, s) => a + s.revenue, 0);
  const monthProfit = thisMonthSales.reduce((a, s) => a + s.profit, 0);
  const inventoryValue = products.reduce((a, p) => a + p.purchasePrice * p.currentStock, 0);
  const lowStock = products.filter(p => p.currentStock <= p.reorderPoint);

  const chartData = useMemo(() => {
    const days = {};
    const now = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      days[key] = { date: key.slice(5), 売上: 0, 利益: 0 };
    }
    enrichedSales.forEach(s => {
      if (days[s.saleDate]) {
        days[s.saleDate].売上 += s.revenue;
        days[s.saleDate].利益 += s.profit;
      }
    });
    return Object.values(days);
  }, [enrichedSales]);

  const categoryData = useMemo(() => {
    const cats = {};
    enrichedSales.forEach(s => {
      const c = s.product?.category ?? "未分類";
      cats[c] = (cats[c] ?? 0) + s.profit;
    });
    return Object.entries(cats).map(([name, 利益]) => ({ name, 利益 }));
  }, [enrichedSales]);

  function upsertProduct(data) {
    setProducts(prev => {
      const exists = prev.some(p => p.id === data.id);
      return exists ? prev.map(p => p.id === data.id ? data : p) : [...prev, data];
    });
    setProductModal(null);
  }
  function deleteProduct(id) {
    if (!confirm("この商品を削除しますか？関連する売上記録は残ります。")) return;
    setProducts(prev => prev.filter(p => p.id !== id));
  }
  function upsertSale(data) {
    setSales(prev => {
      const exists = prev.some(s => s.id === data.id);
      const next = exists ? prev.map(s => s.id === data.id ? data : s) : [...prev, data];
      return next;
    });
    // adjust stock
    setProducts(prev => prev.map(p => {
      if (p.id !== data.id && p.id !== data.productId) return p;
      if (p.id === data.productId && !saleModal?.id) {
        return { ...p, currentStock: Math.max(0, p.currentStock - data.quantity) };
      }
      return p;
    }));
    setSaleModal(null);
  }
  function deleteSale(id) {
    if (!confirm("この売上記録を削除しますか？")) return;
    setSales(prev => prev.filter(s => s.id !== id));
  }

  function exportCSV() {
    const rows = enrichedSales.map(s => ({
      日付: s.saleDate, SKU: s.product?.sku ?? "", 商品名: s.product?.name ?? "",
      数量: s.quantity, 売値: s.salePrice, 仕入値: s.product?.purchasePrice ?? "",
      Amazon手数料: s.amazonFee, 配送コスト: s.shippingCost, 利益: s.profit
    }));
    const csv = Papa.unparse(rows);
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `sedori_sales_${todayStr()}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  function handleCsvFile(e, mode) {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        if (mode === "products") {
          const rows = res.data.map(r => ({
            id: uid(),
            sku: r.sku || r.SKU || r["SKU"] || uid(),
            asin: r.asin || r.ASIN || "",
            name: r.name || r["商品名"] || r.title || "不明な商品",
            category: r.category || r["カテゴリ"] || "未分類",
            purchasePrice: Number(r.purchasePrice || r["仕入値"] || 0),
            currentStock: Number(r.stock || r["在庫数"] || r.quantity || 0),
            reorderPoint: Number(r.reorderPoint || r["発注点"] || 3),
            createdAt: todayStr(),
          })).filter(r => r.name);
          setProducts(prev => [...prev, ...rows]);
        } else {
          const rows = res.data.map(r => {
            const skuOrName = r.sku || r.SKU || r["商品名"] || r.title;
            const match = products.find(p => p.sku === skuOrName || p.name === skuOrName || p.asin === (r.asin || r.ASIN));
            return {
              id: uid(),
              productId: match?.id || null,
              saleDate: r.date || r["日付"] || todayStr(),
              salePrice: Number(r.salePrice || r["売値"] || r.price || 0),
              quantity: Number(r.quantity || r["数量"] || 1),
              amazonFee: Number(r.amazonFee || r["Amazon手数料"] || 0),
              shippingCost: Number(r.shippingCost || r["配送コスト"] || 0),
              notes: match ? "" : "※商品未マッチ（手動で紐付けてください）",
            };
          }).filter(r => r.salePrice > 0);
          setSales(prev => [...prev, ...rows]);
        }
        setCsvOpen(false);
        e.target.value = "";
      },
    });
  }

  const filteredProducts = products.filter(p =>
    !query || p.name.includes(query) || p.sku.includes(query) || p.asin.includes(query)
  );

  if (!loaded) {
    return <div className="min-h-screen flex items-center justify-center bg-[#F5F2E9] text-[#1E2A4A] font-mono text-sm">読み込み中...</div>;
  }

  return (
    <div className="min-h-screen bg-[#F5F2E9] text-[#1E2A4A]" style={{ fontFamily: "'Barlow Condensed','Hiragino Sans',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        .font-mono { font-family: 'IBM Plex Mono', ui-monospace, monospace; }
        .manifest-line { background-image: repeating-linear-gradient(90deg, #D8D3C3 0 8px, transparent 8px 16px); height:1px; }
      `}</style>

      {/* header */}
      <header className="border-b-4 border-[#1E2A4A] bg-[#FCFBF7]">
        <div className="max-w-6xl mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-sm bg-[#1E2A4A] text-[#F5A623] flex items-center justify-center font-black text-lg">S</div>
            <div>
              <h1 className="text-2xl font-bold leading-none tracking-tight">SEDORI MANIFEST</h1>
              <p className="text-[11px] text-[#8A8471] tracking-[0.2em] uppercase font-mono">在庫・売上・出荷管理台帳</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setCsvOpen(true)}
              className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide border border-[#1E2A4A] px-3 py-2 rounded-sm hover:bg-[#1E2A4A] hover:text-white transition-colors">
              <Upload size={14} /> CSV取込
            </button>
            <button onClick={exportCSV}
              className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide border border-[#8A8471] text-[#8A8471] px-3 py-2 rounded-sm hover:bg-[#8A8471] hover:text-white transition-colors">
              <Download size={14} /> エクスポート
            </button>
          </div>
        </div>
        <nav className="max-w-6xl mx-auto px-5 flex gap-1">
          {[
            { id: "dashboard", label: "ダッシュボード", icon: BarChart3 },
            { id: "inventory", label: "在庫管理", icon: Boxes },
            { id: "sales", label: "売上管理", icon: Receipt },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-bold tracking-wide border-b-2 -mb-px transition-colors ${
                tab === t.id ? "border-[#F5A623] text-[#1E2A4A]" : "border-transparent text-[#8A8471] hover:text-[#1E2A4A]"
              }`}>
              <t.icon size={15} /> {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="max-w-6xl mx-auto px-5 py-6">
        {tab === "dashboard" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card className="p-4">
                <p className="text-[11px] font-bold uppercase tracking-widest text-[#8A8471]">今月の売上</p>
                <p className="text-2xl font-mono font-semibold mt-1">{yen(monthRevenue)}</p>
              </Card>
              <Card className="p-4">
                <p className="text-[11px] font-bold uppercase tracking-widest text-[#8A8471]">今月の利益</p>
                <p className={`text-2xl font-mono font-semibold mt-1 ${monthProfit >= 0 ? "text-[#2F6F4E]" : "text-[#B0362C]"}`}>{yen(monthProfit)}</p>
              </Card>
              <Card className="p-4">
                <p className="text-[11px] font-bold uppercase tracking-widest text-[#8A8471]">在庫評価額</p>
                <p className="text-2xl font-mono font-semibold mt-1">{yen(inventoryValue)}</p>
              </Card>
              <Card className="p-4">
                <p className="text-[11px] font-bold uppercase tracking-widest text-[#8A8471]">要補充商品</p>
                <p className="text-2xl font-mono font-semibold mt-1 flex items-center gap-2">
                  {lowStock.length}
                  {lowStock.length > 0 && <Stamp tone="amber">要補充</Stamp>}
                </p>
              </Card>
            </div>

            <Card className="p-5">
              <h3 className="font-bold text-sm uppercase tracking-widest mb-4 text-[#8A8471]">直近14日間の売上・利益推移</h3>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={chartData}>
                  <CartesianGrid stroke="#E4E0D4" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fontFamily: "IBM Plex Mono" }} stroke="#8A8471" />
                  <YAxis tick={{ fontSize: 11, fontFamily: "IBM Plex Mono" }} stroke="#8A8471" />
                  <Tooltip contentStyle={{ fontFamily: "IBM Plex Mono", fontSize: 12, borderRadius: 4 }} />
                  <Line type="monotone" dataKey="売上" stroke="#1E2A4A" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="利益" stroke="#F5A623" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </Card>

            <div className="grid md:grid-cols-2 gap-4">
              <Card className="p-5">
                <h3 className="font-bold text-sm uppercase tracking-widest mb-4 text-[#8A8471]">カテゴリ別利益</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={categoryData}>
                    <CartesianGrid stroke="#E4E0D4" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fontFamily: "IBM Plex Mono" }} stroke="#8A8471" />
                    <YAxis tick={{ fontSize: 11, fontFamily: "IBM Plex Mono" }} stroke="#8A8471" />
                    <Tooltip contentStyle={{ fontFamily: "IBM Plex Mono", fontSize: 12, borderRadius: 4 }} />
                    <Bar dataKey="利益" fill="#2F6F4E" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              <Card className="p-5">
                <h3 className="font-bold text-sm uppercase tracking-widest mb-4 text-[#8A8471] flex items-center gap-2">
                  <AlertTriangle size={14} className="text-[#B7791F]" /> 補充が必要な商品
                </h3>
                {lowStock.length === 0 ? (
                  <p className="text-sm text-[#8A8471] font-mono">現在、補充が必要な商品はありません。</p>
                ) : (
                  <ul className="space-y-2">
                    {lowStock.map(p => (
                      <li key={p.id} className="flex items-center justify-between text-sm border-b border-[#E4E0D4] pb-2">
                        <span>{p.name}</span>
                        <span className="font-mono text-[#B0362C]">在庫 {p.currentStock} / 発注点 {p.reorderPoint}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          </div>
        )}

        {tab === "inventory" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A8471]" />
                <input value={query} onChange={e => setQuery(e.target.value)} placeholder="商品名・SKU・ASINで検索"
                  className={`${inputCls} pl-9`} />
              </div>
              <button onClick={() => setProductModal({})}
                className="flex items-center gap-1.5 bg-[#1E2A4A] text-white text-xs font-bold uppercase tracking-wide px-4 py-2.5 rounded-sm hover:bg-[#16203a]">
                <Plus size={14} /> 商品を追加
              </button>
            </div>
            <Card className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E4E0D4] text-[11px] uppercase tracking-widest text-[#8A8471]">
                    <th className="text-left px-4 py-3">SKU</th>
                    <th className="text-left px-4 py-3">商品名</th>
                    <th className="text-left px-4 py-3">カテゴリ</th>
                    <th className="text-right px-4 py-3">仕入値</th>
                    <th className="text-right px-4 py-3">在庫数</th>
                    <th className="text-right px-4 py-3">発注点</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map(p => (
                    <tr key={p.id} className="border-b border-[#EFEBDD] hover:bg-[#F5F2E9]/60">
                      <td className="px-4 py-3 font-mono text-xs text-[#8A8471]">{p.sku}</td>
                      <td className="px-4 py-3 font-medium">{p.name}</td>
                      <td className="px-4 py-3 text-[#8A8471]">{p.category}</td>
                      <td className="px-4 py-3 text-right font-mono">{yen(p.purchasePrice)}</td>
                      <td className={`px-4 py-3 text-right font-mono font-semibold ${p.currentStock <= p.reorderPoint ? "text-[#B0362C]" : ""}`}>{p.currentStock}</td>
                      <td className="px-4 py-3 text-right font-mono text-[#8A8471]">{p.reorderPoint}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button onClick={() => setProductModal(p)} className="text-[#8A8471] hover:text-[#1E2A4A] mr-2"><Pencil size={14} /></button>
                        <button onClick={() => deleteProduct(p.id)} className="text-[#8A8471] hover:text-[#B0362C]"><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  ))}
                  {filteredProducts.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-[#8A8471] font-mono text-sm">商品がありません。「商品を追加」から登録してください。</td></tr>
                  )}
                </tbody>
              </table>
            </Card>
          </div>
        )}

        {tab === "sales" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm uppercase tracking-widest text-[#8A8471]">売上記録 ({enrichedSales.length}件)</h3>
              <button onClick={() => setSaleModal({})}
                className="flex items-center gap-1.5 bg-[#1E2A4A] text-white text-xs font-bold uppercase tracking-wide px-4 py-2.5 rounded-sm hover:bg-[#16203a]">
                <Plus size={14} /> 売上を記録
              </button>
            </div>
            <Card className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E4E0D4] text-[11px] uppercase tracking-widest text-[#8A8471]">
                    <th className="text-left px-4 py-3">日付</th>
                    <th className="text-left px-4 py-3">商品</th>
                    <th className="text-right px-4 py-3">数量</th>
                    <th className="text-right px-4 py-3">売上</th>
                    <th className="text-right px-4 py-3">手数料+送料</th>
                    <th className="text-right px-4 py-3">利益</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {enrichedSales.slice().reverse().map(s => (
                    <tr key={s.id} className="border-b border-[#EFEBDD] hover:bg-[#F5F2E9]/60">
                      <td className="px-4 py-3 font-mono text-xs text-[#8A8471]">{s.saleDate}</td>
                      <td className="px-4 py-3">{s.product?.name ?? <span className="text-[#B0362C] text-xs">未紐付け</span>}</td>
                      <td className="px-4 py-3 text-right font-mono">{s.quantity}</td>
                      <td className="px-4 py-3 text-right font-mono">{yen(s.revenue)}</td>
                      <td className="px-4 py-3 text-right font-mono text-[#8A8471]">{yen(s.fees)}</td>
                      <td className={`px-4 py-3 text-right font-mono font-semibold ${s.profit >= 0 ? "text-[#2F6F4E]" : "text-[#B0362C]"}`}>{yen(s.profit)}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button onClick={() => setSaleModal(s)} className="text-[#8A8471] hover:text-[#1E2A4A] mr-2"><Pencil size={14} /></button>
                        <button onClick={() => deleteSale(s.id)} className="text-[#8A8471] hover:text-[#B0362C]"><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  ))}
                  {enrichedSales.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-[#8A8471] font-mono text-sm">売上記録がありません。</td></tr>
                  )}
                </tbody>
              </table>
            </Card>
          </div>
        )}
      </main>

      {productModal && (
        <Modal title={productModal.id ? "商品を編集" : "商品を追加"} onClose={() => setProductModal(null)}>
          <ProductForm initial={productModal} onSave={upsertProduct} />
        </Modal>
      )}
      {saleModal && (
        <Modal title={saleModal.id ? "売上を編集" : "売上を記録"} onClose={() => setSaleModal(null)}>
          <SaleForm initial={saleModal} products={products} onSave={upsertSale} />
        </Modal>
      )}
      {csvOpen && (
        <Modal title="CSVインポート" onClose={() => setCsvOpen(false)} wide>
          <div className="space-y-5 text-sm">
            <p className="text-[#8A8471]">Amazon Seller Centralの「レポート」からダウンロードしたCSV、または任意の形式のCSVを取り込めます。列名の日本語・英語どちらにも対応します。</p>
            <div className="border border-[#D8D3C3] rounded-sm p-4">
              <p className="font-bold mb-1">① 商品(在庫)データを取り込む</p>
              <p className="text-xs text-[#8A8471] mb-3">対応列: sku, asin, name(商品名), category(カテゴリ), purchasePrice(仕入値), stock(在庫数), reorderPoint(発注点)</p>
              <input type="file" accept=".csv" onChange={(e) => handleCsvFile(e, "products")}
                className="text-xs font-mono file:mr-3 file:px-3 file:py-1.5 file:border file:border-[#1E2A4A] file:rounded-sm file:bg-white file:text-xs file:font-bold" />
            </div>
            <div className="border border-[#D8D3C3] rounded-sm p-4">
              <p className="font-bold mb-1">② 売上データを取り込む</p>
              <p className="text-xs text-[#8A8471] mb-3">対応列: date(日付), sku, salePrice(売値), quantity(数量), amazonFee(Amazon手数料), shippingCost(配送コスト)。SKU/ASIN/商品名が既存商品と一致すると自動で紐付けます。</p>
              <input type="file" accept=".csv" onChange={(e) => handleCsvFile(e, "sales")}
                className="text-xs font-mono file:mr-3 file:px-3 file:py-1.5 file:border file:border-[#1E2A4A] file:rounded-sm file:bg-white file:text-xs file:font-bold" />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function ProductForm({ initial, onSave }) {
  const [f, setF] = useState({
    id: initial.id ?? uid(),
    sku: initial.sku ?? "",
    asin: initial.asin ?? "",
    name: initial.name ?? "",
    category: initial.category ?? "",
    purchasePrice: initial.purchasePrice ?? 0,
    currentStock: initial.currentStock ?? 0,
    reorderPoint: initial.reorderPoint ?? 3,
    createdAt: initial.createdAt ?? todayStr(),
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(f); }}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="SKU"><input required className={inputCls} value={f.sku} onChange={e => setF({ ...f, sku: e.target.value })} /></Field>
        <Field label="ASIN"><input className={inputCls} value={f.asin} onChange={e => setF({ ...f, asin: e.target.value })} /></Field>
      </div>
      <Field label="商品名"><input required className={inputCls} value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></Field>
      <Field label="カテゴリ"><input className={inputCls} value={f.category} onChange={e => setF({ ...f, category: e.target.value })} /></Field>
      <div className="grid grid-cols-3 gap-3">
        <Field label="仕入値(円)"><input type="number" className={inputCls} value={f.purchasePrice} onChange={e => setF({ ...f, purchasePrice: Number(e.target.value) })} /></Field>
        <Field label="在庫数"><input type="number" className={inputCls} value={f.currentStock} onChange={e => setF({ ...f, currentStock: Number(e.target.value) })} /></Field>
        <Field label="発注点"><input type="number" className={inputCls} value={f.reorderPoint} onChange={e => setF({ ...f, reorderPoint: Number(e.target.value) })} /></Field>
      </div>
      <button type="submit" className="w-full mt-2 bg-[#1E2A4A] text-white font-bold uppercase tracking-wide text-xs py-2.5 rounded-sm hover:bg-[#16203a]">保存する</button>
    </form>
  );
}

function SaleForm({ initial, products, onSave }) {
  const [f, setF] = useState({
    id: initial.id ?? uid(),
    productId: initial.productId ?? (products[0]?.id ?? ""),
    saleDate: initial.saleDate ?? todayStr(),
    salePrice: initial.salePrice ?? 0,
    quantity: initial.quantity ?? 1,
    amazonFee: initial.amazonFee ?? 0,
    shippingCost: initial.shippingCost ?? 0,
    notes: initial.notes ?? "",
  });
  const selected = products.find(p => p.id === f.productId);
  const profit = f.salePrice * f.quantity - (selected?.purchasePrice ?? 0) * f.quantity - f.amazonFee - f.shippingCost;
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(f); }}>
      <Field label="商品">
        <select required className={inputCls} value={f.productId} onChange={e => setF({ ...f, productId: e.target.value })}>
          <option value="" disabled>選択してください</option>
          {products.map(p => <option key={p.id} value={p.id}>{p.name}（在庫{p.currentStock}）</option>)}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="販売日"><input type="date" required className={inputCls} value={f.saleDate} onChange={e => setF({ ...f, saleDate: e.target.value })} /></Field>
        <Field label="数量"><input type="number" min={1} className={inputCls} value={f.quantity} onChange={e => setF({ ...f, quantity: Number(e.target.value) })} /></Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="売値(円)"><input type="number" className={inputCls} value={f.salePrice} onChange={e => setF({ ...f, salePrice: Number(e.target.value) })} /></Field>
        <Field label="Amazon手数料"><input type="number" className={inputCls} value={f.amazonFee} onChange={e => setF({ ...f, amazonFee: Number(e.target.value) })} /></Field>
        <Field label="配送コスト"><input type="number" className={inputCls} value={f.shippingCost} onChange={e => setF({ ...f, shippingCost: Number(e.target.value) })} /></Field>
      </div>
      <div className="flex items-center justify-between border border-[#D8D3C3] rounded-sm px-3 py-2 mb-3 font-mono text-sm">
        <span className="text-[#8A8471]">想定利益</span>
        <span className={profit >= 0 ? "text-[#2F6F4E] font-bold" : "text-[#B0362C] font-bold"}>{yen(profit)}</span>
      </div>
      <button type="submit" className="w-full bg-[#1E2A4A] text-white font-bold uppercase tracking-wide text-xs py-2.5 rounded-sm hover:bg-[#16203a]">保存する</button>
    </form>
  );
}
