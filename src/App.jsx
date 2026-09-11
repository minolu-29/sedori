import React, { useState, useEffect, useMemo } from "react";
import {
  Upload, Plus, Trash2, Pencil, AlertTriangle,
  BarChart3, Boxes, Receipt, X, Search, Download, Target, Wallet, CreditCard
} from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar
} from "recharts";
import Papa from "papaparse";

// ---------- storage keys ----------
const PRODUCTS_KEY = "sedori:products";
const SALES_KEY = "sedori:sales";
const EXPENSES_KEY = "sedori:expenses";
const CARDS_KEY = "sedori:cards";
const PURCHASES_KEY = "sedori:purchases";
const GOALS_KEY = "sedori:goals";

// ブラウザのlocalStorageにデータを保存します(このブラウザ内だけに保存されます)
async function loadKey(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
async function saveKey(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error("storage save failed", key, e);
  }
}

const uid = () => Math.random().toString(36).slice(2, 10);
const yen = (n) => "¥" + Math.round(n || 0).toLocaleString("ja-JP");
const todayStr = () => new Date().toISOString().slice(0, 10);
const currentYm = () => todayStr().slice(0, 7);

function daysInMonth(year, month) { return new Date(year, month + 1, 0).getDate(); }
function clampDay(year, month, day) { return Math.min(day, daysInMonth(year, month)); }

// カードの「締め日」「支払い日」から、直近の支払い日を計算する
// (毎月支払い日は必ず巡ってくるので、過ぎていれば自動的に翌月の支払い日になる)
function nextPaymentDate(card, today = new Date()) {
  const y = today.getFullYear(), m = today.getMonth(), d = today.getDate();
  const payDayThisMonth = clampDay(y, m, card.paymentDay);
  if (d <= payDayThisMonth) return new Date(y, m, payDayThisMonth);
  const nm = m + 1 > 11 ? 0 : m + 1;
  const ny = m + 1 > 11 ? y + 1 : y;
  return new Date(ny, nm, clampDay(ny, nm, card.paymentDay));
}
function daysUntil(date, today = new Date()) {
  const a = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const b = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((b - a) / 86400000);
}
function fmtMd(date) { return `${date.getMonth() + 1}/${date.getDate()}`; }

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
          <button onClick={onClose} className="text-[#8A8471] hover:text-[#1E2A4A]"><X size={18} /></button>
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

function ProgressBar({ value, max, tone = "ink" }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const colors = { ink: "#1E2A4A", amber: "#F5A623", green: "#2F6F4E", red: "#B0362C" };
  return (
    <div className="w-full h-2.5 bg-[#EFEBDD] rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: colors[tone] }} />
    </div>
  );
}

const inputCls =
  "w-full bg-white border border-[#D8D3C3] rounded-sm px-3 py-2 text-sm text-[#1E2A4A] focus:outline-none focus:ring-2 focus:ring-[#1E2A4A]/30 font-mono";

export default function SedoriManager() {
  const [tab, setTab] = useState("dashboard");
  const [products, setProducts] = useState([]);
  const [sales, setSales] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [cards, setCards] = useState([]);
  const [goals, setGoals] = useState({});
  const [loaded, setLoaded] = useState(false);

  const [productModal, setProductModal] = useState(null);
  const [saleModal, setSaleModal] = useState(null);
  const [expenseModal, setExpenseModal] = useState(null);
  const [cardModal, setCardModal] = useState(null);
  const [goalModal, setGoalModal] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    (async () => {
      setProducts((await loadKey(PRODUCTS_KEY, null)) ?? seedProducts);
      setSales((await loadKey(SALES_KEY, null)) ?? []);
      setExpenses((await loadKey(EXPENSES_KEY, null)) ?? []);
      setCards((await loadKey(CARDS_KEY, null)) ?? []);
      setGoals((await loadKey(GOALS_KEY, null)) ?? {});
      setLoaded(true);
    })();
  }, []);

  useEffect(() => { if (loaded) saveKey(PRODUCTS_KEY, products); }, [products, loaded]);
  useEffect(() => { if (loaded) saveKey(SALES_KEY, sales); }, [sales, loaded]);
  useEffect(() => { if (loaded) saveKey(EXPENSES_KEY, expenses); }, [expenses, loaded]);
  useEffect(() => { if (loaded) saveKey(CARDS_KEY, cards); }, [cards, loaded]);
  useEffect(() => { if (loaded) saveKey(GOALS_KEY, goals); }, [goals, loaded]);

  const productMap = useMemo(() => Object.fromEntries(products.map(p => [p.id, p])), [products]);
  const cardMap = useMemo(() => Object.fromEntries(cards.map(c => [c.id, c])), [cards]);

  const enrichedSales = useMemo(() => sales.map(s => {
    const p = productMap[s.productId];
    const cost = (p?.purchasePrice ?? 0) * s.quantity;
    const revenue = s.salePrice * s.quantity;
    const fees = (s.amazonFee ?? 0) + (s.shippingCost ?? 0);
    const profit = revenue - cost - fees;
    return { ...s, product: p, cost, revenue, fees, profit };
  }), [productMap, sales]);

  const ym = currentYm();
  const thisMonthSales = useMemo(() => enrichedSales.filter(s => s.saleDate?.slice(0, 7) === ym), [enrichedSales, ym]);
  const thisMonthExpenses = useMemo(() => expenses.filter(e => e.date?.slice(0, 7) === ym), [expenses, ym]);

  const monthRevenue = thisMonthSales.reduce((a, s) => a + s.revenue, 0);
  const monthGrossProfit = thisMonthSales.reduce((a, s) => a + s.profit, 0);
  const monthExpenseTotal = thisMonthExpenses.reduce((a, e) => a + e.amount, 0);
  const monthRealProfit = monthGrossProfit - monthExpenseTotal;

  const inventoryValue = products.reduce((a, p) => a + p.purchasePrice * p.currentStock, 0);
  const lowStock = products.filter(p => p.currentStock <= p.reorderPoint);

  const currentGoal = goals[ym] ?? { revenueGoal: 0, profitGoal: 0 };
  const revenuePct = currentGoal.revenueGoal > 0 ? (monthRevenue / currentGoal.revenueGoal) * 100 : 0;
  const profitPct = currentGoal.profitGoal > 0 ? (monthRealProfit / currentGoal.profitGoal) * 100 : 0;

  const cardSpend = useMemo(() => {
    const map = {};
    thisMonthExpenses.forEach(e => {
      if (!e.cardId) return;
      map[e.cardId] = (map[e.cardId] ?? 0) + e.amount;
    });
    return map;
  }, [thisMonthExpenses]);

  const chartData = useMemo(() => {
    const days = {};
    const now = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      days[key] = { date: key.slice(5), 売上: 0, 利益: 0 };
    }
    enrichedSales.forEach(s => { if (days[s.saleDate]) { days[s.saleDate].売上 += s.revenue; days[s.saleDate].利益 += s.profit; } });
    return Object.values(days);
  }, [enrichedSales]);

  const categoryData = useMemo(() => {
    const cats = {};
    enrichedSales.forEach(s => { const c = s.product?.category ?? "未分類"; cats[c] = (cats[c] ?? 0) + s.profit; });
    return Object.entries(cats).map(([name, 利益]) => ({ name, 利益 }));
  }, [enrichedSales]);

  // ---- CRUD ----
  function upsertProduct(data) {
    const isNew = !products.some(p => p.id === data.id);
    setProducts(prev => prev.some(p => p.id === data.id) ? prev.map(p => p.id === data.id ? data : p) : [...prev, data]);
    if (isNew && data.cardId && data.purchasePrice > 0 && data.currentStock > 0) {
      setExpenses(prev => [...prev, {
        id: uid(), date: todayStr(), category: "仕入れ",
        amount: data.purchasePrice * data.currentStock,
        cardId: data.cardId, memo: `${data.name} 仕入れ（初回登録）`,
      }]);
    }
    setProductModal(null);
  }
  function deleteProduct(id) {
    if (!confirm("この商品を削除しますか？関連する売上記録は残ります。")) return;
    setProducts(prev => prev.filter(p => p.id !== id));
  }
  function upsertSale(data) {
    const isNew = !saleModal?.id;
    setSales(prev => prev.some(s => s.id === data.id) ? prev.map(s => s.id === data.id ? data : s) : [...prev, data]);
    if (isNew) {
      setProducts(prev => prev.map(p => p.id === data.productId ? { ...p, currentStock: Math.max(0, p.currentStock - data.quantity) } : p));
    }
    setSaleModal(null);
  }
  function deleteSale(id) {
    if (!confirm("この売上記録を削除しますか？")) return;
    setSales(prev => prev.filter(s => s.id !== id));
  }
  function upsertExpense(data) {
    setExpenses(prev => prev.some(e => e.id === data.id) ? prev.map(e => e.id === data.id ? data : e) : [...prev, data]);
    setExpenseModal(null);
  }
  function deleteExpense(id) {
    if (!confirm("この経費を削除しますか？")) return;
    setExpenses(prev => prev.filter(e => e.id !== id));
  }
  function upsertCard(data) {
    setCards(prev => prev.some(c => c.id === data.id) ? prev.map(c => c.id === data.id ? data : c) : [...prev, data]);
    setCardModal(null);
  }
  function deleteCard(id) {
    if (!confirm("このカードを削除しますか？紐付いた経費のカード情報は解除されます。")) return;
    setCards(prev => prev.filter(c => c.id !== id));
    setExpenses(prev => prev.map(e => e.cardId === id ? { ...e, cardId: null } : e));
  }
  function saveGoal(data) {
    setGoals(prev => ({ ...prev, [ym]: data }));
    setGoalModal(false);
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
      header: true, skipEmptyLines: true,
      complete: (res) => {
        if (mode === "products") {
          const rows = res.data.map(r => ({
            id: uid(), sku: r.sku || r.SKU || uid(), asin: r.asin || r.ASIN || "",
            name: r.name || r["商品名"] || r.title || "不明な商品",
            category: r.category || r["カテゴリ"] || "未分類",
            purchasePrice: Number(r.purchasePrice || r["仕入値"] || 0),
            currentStock: Number(r.stock || r["在庫数"] || r.quantity || 0),
            reorderPoint: Number(r.reorderPoint || r["発注点"] || 3),
            createdAt: todayStr(),
          })).filter(r => r.name);
          setProducts(prev => [...prev, ...rows]);
        } else if (mode === "sales") {
          const rows = res.data.map(r => {
            const skuOrName = r.sku || r.SKU || r["商品名"] || r.title;
            const match = products.find(p => p.sku === skuOrName || p.name === skuOrName || p.asin === (r.asin || r.ASIN));
            return {
              id: uid(), productId: match?.id || null,
              saleDate: r.date || r["日付"] || todayStr(),
              salePrice: Number(r.salePrice || r["売値"] || r.price || 0),
              quantity: Number(r.quantity || r["数量"] || 1),
              amazonFee: Number(r.amazonFee || r["Amazon手数料"] || 0),
              shippingCost: Number(r.shippingCost || r["配送コスト"] || 0),
              notes: match ? "" : "※商品未マッチ（手動で紐付けてください）",
            };
          }).filter(r => r.salePrice > 0);
          setSales(prev => [...prev, ...rows]);
        } else if (mode === "expenses") {
          const rows = res.data.map(r => ({
            id: uid(),
            date: r.date || r["日付"] || todayStr(),
            category: r.category || r["カテゴリ"] || "その他",
            amount: Number(r.amount || r["金額"] || 0),
            cardId: null,
            memo: r.memo || r["メモ"] || "",
          })).filter(r => r.amount > 0);
          setExpenses(prev => [...prev, ...rows]);
        }
        setCsvOpen(false);
        e.target.value = "";
      },
    });
  }

  const filteredProducts = products.filter(p => !query || p.name.includes(query) || p.sku.includes(query) || p.asin.includes(query));

  const productDeadline = useMemo(() => {
    const map = {};
    const today = new Date();
    products.forEach(p => {
      const card = p.cardId ? cardMap[p.cardId] : null;
      if (!card || !p.currentStock) return;
      const due = nextPaymentDate(card, today);
      map[p.id] = { due, days: daysUntil(due, today), cardName: card.name };
    });
    return map;
  }, [products, cardMap]);

  if (!loaded) return <div className="min-h-screen flex items-center justify-center bg-[#F5F2E9] text-[#1E2A4A] font-mono text-sm">読み込み中...</div>;

  return (
    <div className="min-h-screen bg-[#F5F2E9] text-[#1E2A4A]" style={{ fontFamily: "'Barlow Condensed','Hiragino Sans',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        .font-mono { font-family: 'IBM Plex Mono', ui-monospace, monospace; }
      `}</style>

      <header className="border-b-4 border-[#1E2A4A] bg-[#FCFBF7]">
        <div className="max-w-6xl mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-sm bg-[#1E2A4A] text-[#F5A623] flex items-center justify-center font-black text-lg">S</div>
            <div>
              <h1 className="text-2xl font-bold leading-none tracking-tight">SEDORI MANIFEST</h1>
              <p className="text-[11px] text-[#8A8471] tracking-[0.2em] uppercase font-mono">在庫・売上・経費・目標管理台帳</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setCsvOpen(true)} className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide border border-[#1E2A4A] px-3 py-2 rounded-sm hover:bg-[#1E2A4A] hover:text-white transition-colors">
              <Upload size={14} /> CSV取込
            </button>
            <button onClick={exportCSV} className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide border border-[#8A8471] text-[#8A8471] px-3 py-2 rounded-sm hover:bg-[#8A8471] hover:text-white transition-colors">
              <Download size={14} /> エクスポート
            </button>
          </div>
        </div>
        <nav className="max-w-6xl mx-auto px-5 flex gap-1 overflow-x-auto">
          {[
            { id: "dashboard", label: "ダッシュボード", icon: BarChart3 },
            { id: "inventory", label: "在庫管理", icon: Boxes },
            { id: "sales", label: "売上管理", icon: Receipt },
            { id: "expenses", label: "経費・カード", icon: Wallet },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-bold tracking-wide border-b-2 -mb-px whitespace-nowrap transition-colors ${
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
                <p className="text-[11px] font-bold uppercase tracking-widest text-[#8A8471]">今月の実利益</p>
                <p className={`text-2xl font-mono font-semibold mt-1 ${monthRealProfit >= 0 ? "text-[#2F6F4E]" : "text-[#B0362C]"}`}>{yen(monthRealProfit)}</p>
                <p className="text-[10px] text-[#8A8471] font-mono mt-0.5">粗利{yen(monthGrossProfit)} − 経費{yen(monthExpenseTotal)}</p>
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
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-sm uppercase tracking-widest text-[#8A8471] flex items-center gap-2">
                  <Target size={14} /> 今月の目標進捗 ({ym})
                </h3>
                <button onClick={() => setGoalModal(true)} className="text-xs font-bold uppercase tracking-wide text-[#1E2A4A] border border-[#1E2A4A] px-3 py-1.5 rounded-sm hover:bg-[#1E2A4A] hover:text-white">
                  目標を設定
                </button>
              </div>
              {currentGoal.revenueGoal === 0 && currentGoal.profitGoal === 0 ? (
                <p className="text-sm text-[#8A8471] font-mono">まだ今月の目標が設定されていません。「目標を設定」から登録できます。</p>
              ) : (
                <div className="space-y-4">
                  {currentGoal.revenueGoal > 0 && (
                    <div>
                      <div className="flex justify-between text-sm font-mono mb-1">
                        <span className="text-[#8A8471]">売上目標</span>
                        <span>{yen(monthRevenue)} / {yen(currentGoal.revenueGoal)}（{revenuePct.toFixed(0)}%）</span>
                      </div>
                      <ProgressBar value={monthRevenue} max={currentGoal.revenueGoal} tone={revenuePct >= 100 ? "green" : "ink"} />
                    </div>
                  )}
                  {currentGoal.profitGoal > 0 && (
                    <div>
                      <div className="flex justify-between text-sm font-mono mb-1">
                        <span className="text-[#8A8471]">利益目標</span>
                        <span>{yen(monthRealProfit)} / {yen(currentGoal.profitGoal)}（{profitPct.toFixed(0)}%）</span>
                      </div>
                      <ProgressBar value={monthRealProfit} max={currentGoal.profitGoal} tone={profitPct >= 100 ? "green" : "amber"} />
                    </div>
                  )}
                </div>
              )}
            </Card>

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

            {cards.length > 0 && (
              <Card className="p-5">
                <h3 className="font-bold text-sm uppercase tracking-widest mb-4 text-[#8A8471] flex items-center gap-2">
                  <CreditCard size={14} /> 今月のカード利用状況
                </h3>
                <div className="space-y-4">
                  {cards.map(c => {
                    const spent = cardSpend[c.id] ?? 0;
                    const pct = c.limit > 0 ? (spent / c.limit) * 100 : 0;
                    const tone = pct >= 100 ? "red" : pct >= 80 ? "amber" : "ink";
                    return (
                      <div key={c.id}>
                        <div className="flex justify-between text-sm font-mono mb-1">
                          <span>{c.name}{pct >= 80 && <Stamp tone={tone === "red" ? "red" : "amber"}>{pct >= 100 ? "超過" : "要注意"}</Stamp>}</span>
                          <span>{yen(spent)} / {yen(c.limit)}（{pct.toFixed(0)}%）</span>
                        </div>
                        <ProgressBar value={spent} max={c.limit} tone={tone} />
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}
          </div>
        )}

        {tab === "inventory" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A8471]" />
                <input value={query} onChange={e => setQuery(e.target.value)} placeholder="商品名・SKU・ASINで検索" className={`${inputCls} pl-9`} />
              </div>
              <button onClick={() => setProductModal({})} className="flex items-center gap-1.5 bg-[#1E2A4A] text-white text-xs font-bold uppercase tracking-wide px-4 py-2.5 rounded-sm hover:bg-[#16203a]">
                <Plus size={14} /> 商品を追加
              </button>
            </div>
            <Card className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E4E0D4] text-[11px] uppercase tracking-widest text-[#8A8471]">
                    <th className="text-left px-4 py-3">SKU</th><th className="text-left px-4 py-3">商品名</th><th className="text-left px-4 py-3">カテゴリ</th>
                    <th className="text-right px-4 py-3">仕入値</th><th className="text-right px-4 py-3">在庫数</th><th className="text-right px-4 py-3">発注点</th>
                    <th className="text-left px-4 py-3">支払い期限</th><th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map(p => {
                    const dl = productDeadline[p.id];
                    return (
                    <tr key={p.id} className="border-b border-[#EFEBDD] hover:bg-[#F5F2E9]/60">
                      <td className="px-4 py-3 font-mono text-xs text-[#8A8471]">{p.sku}</td>
                      <td className="px-4 py-3 font-medium">{p.name}</td>
                      <td className="px-4 py-3 text-[#8A8471]">{p.category}</td>
                      <td className="px-4 py-3 text-right font-mono">{yen(p.purchasePrice)}</td>
                      <td className={`px-4 py-3 text-right font-mono font-semibold ${p.currentStock <= p.reorderPoint ? "text-[#B0362C]" : ""}`}>{p.currentStock}</td>
                      <td className="px-4 py-3 text-right font-mono text-[#8A8471]">{p.reorderPoint}</td>
                      <td className="px-4 py-3">
                        {!dl ? (
                          <span className="text-[#C9C4B2] text-xs font-mono">-</span>
                        ) : dl.days <= 3 ? (
                          <Stamp tone={dl.days <= 0 ? "red" : "amber"}>
                            {dl.cardName} {fmtMd(dl.due)}支払い{dl.days <= 0 ? "・本日〆" : `・あと${dl.days}日`}
                          </Stamp>
                        ) : (
                          <span className="text-xs font-mono text-[#8A8471]">{dl.cardName} {fmtMd(dl.due)}支払い</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button onClick={() => setProductModal(p)} className="text-[#8A8471] hover:text-[#1E2A4A] mr-2"><Pencil size={14} /></button>
                        <button onClick={() => deleteProduct(p.id)} className="text-[#8A8471] hover:text-[#B0362C]"><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  );})}
                  {filteredProducts.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-[#8A8471] font-mono text-sm">商品がありません。</td></tr>}
                </tbody>
              </table>
            </Card>
          </div>
        )}

        {tab === "sales" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm uppercase tracking-widest text-[#8A8471]">売上記録 ({enrichedSales.length}件)</h3>
              <button onClick={() => setSaleModal({})} className="flex items-center gap-1.5 bg-[#1E2A4A] text-white text-xs font-bold uppercase tracking-wide px-4 py-2.5 rounded-sm hover:bg-[#16203a]">
                <Plus size={14} /> 売上を記録
              </button>
            </div>
            <Card className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E4E0D4] text-[11px] uppercase tracking-widest text-[#8A8471]">
                    <th className="text-left px-4 py-3">日付</th><th className="text-left px-4 py-3">商品</th><th className="text-right px-4 py-3">数量</th>
                    <th className="text-right px-4 py-3">売上</th><th className="text-right px-4 py-3">手数料+送料</th><th className="text-right px-4 py-3">利益</th><th className="px-4 py-3"></th>
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
                  {enrichedSales.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-[#8A8471] font-mono text-sm">売上記録がありません。</td></tr>}
                </tbody>
              </table>
            </Card>
          </div>
        )}

        {tab === "expenses" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="font-bold text-sm uppercase tracking-widest text-[#8A8471]">カード管理</h3>
              <button onClick={() => setCardModal({})} className="flex items-center gap-1.5 bg-[#1E2A4A] text-white text-xs font-bold uppercase tracking-wide px-4 py-2.5 rounded-sm hover:bg-[#16203a]">
                <Plus size={14} /> カードを追加
              </button>
            </div>
            <Card className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E4E0D4] text-[11px] uppercase tracking-widest text-[#8A8471]">
                    <th className="text-left px-4 py-3">カード名</th><th className="text-right px-4 py-3">限度額</th><th className="text-right px-4 py-3">今月の利用額</th><th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {cards.map(c => {
                    const spent = cardSpend[c.id] ?? 0;
                    const over = c.limit > 0 && spent >= c.limit;
                    return (
                      <tr key={c.id} className="border-b border-[#EFEBDD] hover:bg-[#F5F2E9]/60">
                        <td className="px-4 py-3 font-medium">{c.name}</td>
                        <td className="px-4 py-3 text-right font-mono">{yen(c.limit)}</td>
                        <td className={`px-4 py-3 text-right font-mono font-semibold ${over ? "text-[#B0362C]" : ""}`}>{yen(spent)}</td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <button onClick={() => setCardModal(c)} className="text-[#8A8471] hover:text-[#1E2A4A] mr-2"><Pencil size={14} /></button>
                          <button onClick={() => deleteCard(c.id)} className="text-[#8A8471] hover:text-[#B0362C]"><Trash2 size={14} /></button>
                        </td>
                      </tr>
                    );
                  })}
                  {cards.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-[#8A8471] font-mono text-sm">カードが登録されていません。</td></tr>}
                </tbody>
              </table>
            </Card>

            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="font-bold text-sm uppercase tracking-widest text-[#8A8471]">経費記録 ({expenses.length}件・今月合計 {yen(monthExpenseTotal)})</h3>
              <button onClick={() => setExpenseModal({})} className="flex items-center gap-1.5 bg-[#1E2A4A] text-white text-xs font-bold uppercase tracking-wide px-4 py-2.5 rounded-sm hover:bg-[#16203a]">
                <Plus size={14} /> 経費を記録
              </button>
            </div>
            <Card className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E4E0D4] text-[11px] uppercase tracking-widest text-[#8A8471]">
                    <th className="text-left px-4 py-3">日付</th><th className="text-left px-4 py-3">カテゴリ</th><th className="text-left px-4 py-3">カード</th>
                    <th className="text-right px-4 py-3">金額</th><th className="text-left px-4 py-3">メモ</th><th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.slice().reverse().map(e => (
                    <tr key={e.id} className="border-b border-[#EFEBDD] hover:bg-[#F5F2E9]/60">
                      <td className="px-4 py-3 font-mono text-xs text-[#8A8471]">{e.date}</td>
                      <td className="px-4 py-3">{e.category}</td>
                      <td className="px-4 py-3 text-[#8A8471]">{e.cardId ? cardMap[e.cardId]?.name ?? "-" : "-"}</td>
                      <td className="px-4 py-3 text-right font-mono">{yen(e.amount)}</td>
                      <td className="px-4 py-3 text-[#8A8471] text-xs">{e.memo}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button onClick={() => setExpenseModal(e)} className="text-[#8A8471] hover:text-[#1E2A4A] mr-2"><Pencil size={14} /></button>
                        <button onClick={() => deleteExpense(e.id)} className="text-[#8A8471] hover:text-[#B0362C]"><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  ))}
                  {expenses.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-[#8A8471] font-mono text-sm">経費記録がありません。</td></tr>}
                </tbody>
              </table>
            </Card>
          </div>
        )}
      </main>

      {productModal && <Modal title={productModal.id ? "商品を編集" : "商品を追加"} onClose={() => setProductModal(null)}><ProductForm initial={productModal} cards={cards} onSave={upsertProduct} /></Modal>}
      {saleModal && <Modal title={saleModal.id ? "売上を編集" : "売上を記録"} onClose={() => setSaleModal(null)}><SaleForm initial={saleModal} products={products} onSave={upsertSale} /></Modal>}
      {expenseModal && <Modal title={expenseModal.id ? "経費を編集" : "経費を記録"} onClose={() => setExpenseModal(null)}><ExpenseForm initial={expenseModal} cards={cards} onSave={upsertExpense} /></Modal>}
      {cardModal && <Modal title={cardModal.id ? "カードを編集" : "カードを追加"} onClose={() => setCardModal(null)}><CardForm initial={cardModal} onSave={upsertCard} /></Modal>}
      {goalModal && <Modal title={`${ym} の目標設定`} onClose={() => setGoalModal(false)}><GoalForm initial={currentGoal} onSave={saveGoal} /></Modal>}

      {csvOpen && (
        <Modal title="CSVインポート" onClose={() => setCsvOpen(false)} wide>
          <div className="space-y-5 text-sm">
            <p className="text-[#8A8471]">Amazon Seller Centralの「レポート」からダウンロードしたCSV、または任意の形式のCSVを取り込めます。列名の日本語・英語どちらにも対応します。</p>
            <div className="border border-[#D8D3C3] rounded-sm p-4">
              <p className="font-bold mb-1">① 商品(在庫)データを取り込む</p>
              <p className="text-xs text-[#8A8471] mb-3">対応列: sku, asin, name(商品名), category(カテゴリ), purchasePrice(仕入値), stock(在庫数), reorderPoint(発注点)</p>
              <input type="file" accept=".csv" onChange={(e) => handleCsvFile(e, "products")} className="text-xs font-mono file:mr-3 file:px-3 file:py-1.5 file:border file:border-[#1E2A4A] file:rounded-sm file:bg-white file:text-xs file:font-bold" />
            </div>
            <div className="border border-[#D8D3C3] rounded-sm p-4">
              <p className="font-bold mb-1">② 売上データを取り込む</p>
              <p className="text-xs text-[#8A8471] mb-3">対応列: date(日付), sku, salePrice(売値), quantity(数量), amazonFee(Amazon手数料), shippingCost(配送コスト)。SKU/ASIN/商品名が既存商品と一致すると自動で紐付けます。</p>
              <input type="file" accept=".csv" onChange={(e) => handleCsvFile(e, "sales")} className="text-xs font-mono file:mr-3 file:px-3 file:py-1.5 file:border file:border-[#1E2A4A] file:rounded-sm file:bg-white file:text-xs file:font-bold" />
            </div>
            <div className="border border-[#D8D3C3] rounded-sm p-4">
              <p className="font-bold mb-1">③ 経費データを取り込む</p>
              <p className="text-xs text-[#8A8471] mb-3">対応列: date(日付), category(カテゴリ), amount(金額), memo(メモ)</p>
              <input type="file" accept=".csv" onChange={(e) => handleCsvFile(e, "expenses")} className="text-xs font-mono file:mr-3 file:px-3 file:py-1.5 file:border file:border-[#1E2A4A] file:rounded-sm file:bg-white file:text-xs file:font-bold" />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function ProductForm({ initial, cards, onSave }) {
  const isNew = !initial.id;
  const [f, setF] = useState({
    id: initial.id ?? uid(), sku: initial.sku ?? "", asin: initial.asin ?? "", name: initial.name ?? "",
    category: initial.category ?? "", purchasePrice: initial.purchasePrice ?? 0, currentStock: initial.currentStock ?? 0,
    reorderPoint: initial.reorderPoint ?? 3, createdAt: initial.createdAt ?? todayStr(), cardId: initial.cardId ?? "",
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
      <Field label={isNew ? "仕入れ時の支払カード(任意・経費に自動記録されます)" : "支払カード(在庫の支払い期限アラートに使用)"}>
        <select className={inputCls} value={f.cardId} onChange={e => setF({ ...f, cardId: e.target.value })}>
          <option value="">現金・指定なし</option>
          {cards.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
      {!isNew && <p className="text-xs text-[#8A8471] font-mono -mt-2 mb-3">同じカードで買い足す場合は変更不要です。支払い期限が過ぎていれば自動的に翌月の支払い日に更新されます。</p>}
      <button type="submit" className="w-full mt-2 bg-[#1E2A4A] text-white font-bold uppercase tracking-wide text-xs py-2.5 rounded-sm hover:bg-[#16203a]">保存する</button>
    </form>
  );
}

function SaleForm({ initial, products, onSave }) {
  const [f, setF] = useState({
    id: initial.id ?? uid(), productId: initial.productId ?? (products[0]?.id ?? ""), saleDate: initial.saleDate ?? todayStr(),
    salePrice: initial.salePrice ?? 0, quantity: initial.quantity ?? 1, amazonFee: initial.amazonFee ?? 0,
    shippingCost: initial.shippingCost ?? 0, notes: initial.notes ?? "",
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

function ExpenseForm({ initial, cards, onSave }) {
  const [f, setF] = useState({
    id: initial.id ?? uid(), date: initial.date ?? todayStr(), category: initial.category ?? "広告費",
    amount: initial.amount ?? 0, cardId: initial.cardId ?? "", memo: initial.memo ?? "",
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave({ ...f, cardId: f.cardId || null }); }}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="日付"><input type="date" required className={inputCls} value={f.date} onChange={e => setF({ ...f, date: e.target.value })} /></Field>
        <Field label="金額(円)"><input type="number" required className={inputCls} value={f.amount} onChange={e => setF({ ...f, amount: Number(e.target.value) })} /></Field>
      </div>
      <Field label="カテゴリ">
        <select className={inputCls} value={f.category} onChange={e => setF({ ...f, category: e.target.value })}>
          {["仕入れ", "広告費", "梱包資材", "ツール利用料", "配送・郵送費", "外注費", "その他"].map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </Field>
      <Field label="支払カード(任意)">
        <select className={inputCls} value={f.cardId} onChange={e => setF({ ...f, cardId: e.target.value })}>
          <option value="">現金・指定なし</option>
          {cards.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
      <Field label="メモ"><input className={inputCls} value={f.memo} onChange={e => setF({ ...f, memo: e.target.value })} /></Field>
      <button type="submit" className="w-full mt-2 bg-[#1E2A4A] text-white font-bold uppercase tracking-wide text-xs py-2.5 rounded-sm hover:bg-[#16203a]">保存する</button>
    </form>
  );
}

function CardForm({ initial, onSave }) {
  const [f, setF] = useState({
    id: initial.id ?? uid(), name: initial.name ?? "", limit: initial.limit ?? 0,
    closingDay: initial.closingDay ?? 15, paymentDay: initial.paymentDay ?? 10,
  });
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(f); }}>
      <Field label="カード名（例: 楽天カード末尾1234）"><input required className={inputCls} value={f.name} onChange={e => setF({ ...f, name: e.target.value })} /></Field>
      <Field label="限度額(円)"><input type="number" required className={inputCls} value={f.limit} onChange={e => setF({ ...f, limit: Number(e.target.value) })} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="締め日(毎月)">
          <select className={inputCls} value={f.closingDay} onChange={e => setF({ ...f, closingDay: Number(e.target.value) })}>
            {Array.from({ length: 31 }, (_, i) => i + 1).map(d => <option key={d} value={d}>{d}日</option>)}
          </select>
        </Field>
        <Field label="支払い日(翌月)">
          <select className={inputCls} value={f.paymentDay} onChange={e => setF({ ...f, paymentDay: Number(e.target.value) })}>
            {Array.from({ length: 31 }, (_, i) => i + 1).map(d => <option key={d} value={d}>{d}日</option>)}
          </select>
        </Field>
      </div>
      <p className="text-xs text-[#8A8471] font-mono mb-3">在庫の「支払い期限」表示は、この支払い日をもとに自動計算されます。</p>
      <button type="submit" className="w-full mt-2 bg-[#1E2A4A] text-white font-bold uppercase tracking-wide text-xs py-2.5 rounded-sm hover:bg-[#16203a]">保存する</button>
    </form>
  );
}

function GoalForm({ initial, onSave }) {
  const [f, setF] = useState({ revenueGoal: initial.revenueGoal ?? 0, profitGoal: initial.profitGoal ?? 0 });
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(f); }}>
      <Field label="今月の売上目標(円)"><input type="number" className={inputCls} value={f.revenueGoal} onChange={e => setF({ ...f, revenueGoal: Number(e.target.value) })} /></Field>
      <Field label="今月の利益目標(円)"><input type="number" className={inputCls} value={f.profitGoal} onChange={e => setF({ ...f, profitGoal: Number(e.target.value) })} /></Field>
      <button type="submit" className="w-full mt-2 bg-[#1E2A4A] text-white font-bold uppercase tracking-wide text-xs py-2.5 rounded-sm hover:bg-[#16203a]">保存する</button>
    </form>
  );
}
