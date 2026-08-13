"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Category = "仕事" | "買い物" | "食事" | "イベント" | "その他";
type Place = { name: string; area: string; lat: number; lng: number };
type PlaceSuggestion = Place & { id: string; address: string; type: string };
type ScheduleEvent = Place & { id: string; title: string; date: string; start: string; end: string; category: Category; flexible: boolean };

const places: Place[] = [
  { name: "新宿駅", area: "新宿", lat: 35.6896, lng: 139.7006 },
  { name: "渋谷駅", area: "渋谷", lat: 35.658, lng: 139.7016 },
  { name: "東京駅", area: "丸の内", lat: 35.6812, lng: 139.7671 },
  { name: "秋葉原駅", area: "秋葉原", lat: 35.6984, lng: 139.7731 },
  { name: "有明アリーナ", area: "有明", lat: 35.6445, lng: 139.7947 },
  { name: "横浜駅", area: "横浜", lat: 35.4657, lng: 139.6223 },
];
const categories: Category[] = ["仕事", "買い物", "食事", "イベント", "その他"];

function isoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
function seedEvents(date: string): ScheduleEvent[] {
  return [
    { id: "seed-1", title: "午前の買い物", date, start: "10:00", end: "11:00", category: "買い物", flexible: true, ...places[5] },
    { id: "seed-2", title: "期間限定イベント", date, start: "13:00", end: "15:00", category: "イベント", flexible: false, ...places[1] },
    { id: "seed-3", title: "友人と夕食", date, start: "17:00", end: "18:15", category: "食事", flexible: true, ...places[0] },
    { id: "seed-4", title: "夜のライブ", date, start: "19:00", end: "21:00", category: "イベント", flexible: false, ...places[1] },
  ];
}
function toMinutes(value: string) { const [h, m] = value.split(":").map(Number); return h * 60 + m; }
function haversine(a: Place, b: Place) {
  const r = 6371, rad = Math.PI / 180, dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(x));
}
function travelMinutes(a: Place, b: Place) { return Math.max(8, Math.round(haversine(a, b) * 1.15 + 12)); }
function mapPoint(place: Place) {
  return { x: Math.min(93, Math.max(7, ((place.lng - 139.57) / .26) * 100)), y: Math.min(89, Math.max(9, ((35.73 - place.lat) / .3) * 100)) };
}
function addDays(dateString: string, amount: number) { const date = new Date(`${dateString}T12:00:00`); date.setDate(date.getDate() + amount); return date; }
function formatLongDate(date: string) { return new Intl.DateTimeFormat("ja-JP", { month: "long", day: "numeric", weekday: "short", timeZone: "Asia/Tokyo" }).format(new Date(`${date}T12:00:00+09:00`)); }

export default function Home() {
  const [selectedDate, setSelectedDate] = useState("2000-01-01");
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [ready, setReady] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const today = isoDate(new Date());
      setSelectedDate(today);
      const stored = window.localStorage.getItem("dayroute-events");
      setEvents(stored ? JSON.parse(stored) : seedEvents(today));
      setReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => { if (ready) window.localStorage.setItem("dayroute-events", JSON.stringify(events)); }, [events, ready]);

  const dayEvents = useMemo(() => events.filter(e => e.date === selectedDate).sort((a, b) => a.start.localeCompare(b.start)), [events, selectedDate]);
  const routes = useMemo(() => dayEvents.slice(0, -1).map((from, index) => {
    const to = dayEvents[index + 1], minutes = travelMinutes(from, to), gap = toMinutes(to.start) - toMinutes(from.end);
    return { from, to, minutes, gap, tight: gap < minutes + 10 };
  }), [dayEvents]);
  const summary = useMemo(() => {
    const travel = routes.reduce((sum, route) => sum + route.minutes, 0);
    const distance = routes.reduce((sum, route) => sum + haversine(route.from, route.to), 0);
    const tightRoutes = routes.filter(route => route.tight), areas = new Set(dayEvents.map(event => event.area)).size;
    const density = Math.min(100, Math.round(dayEvents.length * 8 + travel * .35 + areas * 5 + tightRoutes.length * 20));
    return { travel, distance: Math.round(distance), tightRoutes, density };
  }, [dayEvents, routes]);
  const week = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(selectedDate, i - 3)), [selectedDate]);
  const densityLabel = summary.density >= 75 ? "要調整" : summary.density >= 50 ? "やや高密度" : "余裕あり";

  function addEvent(event: ScheduleEvent) {
    setEvents(current => [...current, event]); setShowForm(false); setNotice("予定を追加しました");
    window.setTimeout(() => setNotice(""), 2400);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top"><span className="brand-mark"><span /></span><span>DayRoute</span></a>
        <nav className="nav-tabs"><button className="nav-tab active">プラン</button><button className="nav-tab">振り返り</button></nav>
        <div className="top-actions"><span className="local-badge">この端末に保存</span><button className="add-button" onClick={() => setShowForm(true)}>＋ 予定を追加</button></div>
      </header>

      <section className="date-rail" id="top">
        <button className="round-button" onClick={() => setSelectedDate(isoDate(addDays(selectedDate, -7)))} aria-label="前の週">‹</button>
        <div className="date-strip">{week.map(date => {
          const key = isoDate(date), active = key === selectedDate, count = events.filter(event => event.date === key).length;
          return <button key={key} className={`date-chip ${active ? "active" : ""}`} onClick={() => setSelectedDate(key)}><span>{new Intl.DateTimeFormat("ja-JP", { weekday: "short", timeZone: "Asia/Tokyo" }).format(date)}</span><strong>{date.getDate()}</strong><i className={count ? "has-events" : ""} /></button>;
        })}</div>
        <button className="round-button" onClick={() => setSelectedDate(isoDate(addDays(selectedDate, 7)))} aria-label="次の週">›</button>
      </section>

      <section className="summary-bar">
        <div><p className="eyebrow">TODAY&apos;S ROUTE</p><h1>{formatLongDate(selectedDate)}のプラン</h1></div>
        <div className="summary-metrics">
          <Metric label="予定" value={`${dayEvents.length}件`} /><Metric label="移動" value={`約${summary.travel}分`} /><Metric label="距離" value={`約${summary.distance}km`} />
          <div className={`density-pill density-${densityLabel}`}><span>移動負荷</span><strong>{densityLabel}</strong><i style={{ width: `${Math.max(8, summary.density)}%` }} /></div>
        </div>
      </section>

      <section className="workspace">
        <div className="schedule-panel">
          <div className="panel-heading"><div><p className="eyebrow">SCHEDULE</p><h2>時間順の予定</h2></div><button className="icon-button" onClick={() => setShowForm(true)} aria-label="予定を追加">＋</button></div>
          <div className="timeline">
            {!ready ? <p className="empty-state">予定を読み込んでいます…</p> : dayEvents.length === 0 ? (
              <div className="empty-state"><span>◎</span><strong>この日の予定はありません</strong><p>場所のある予定を追加すると、移動ルートを確認できます。</p><button onClick={() => setShowForm(true)}>最初の予定を追加</button></div>
            ) : dayEvents.map((event, index) => {
              const route = routes[index];
              return <div className="timeline-group" key={event.id}>
                <article className={`event-card category-${event.category}`}>
                  <div className="event-time"><strong>{event.start}</strong><span>{event.end}</span></div><div className="event-line"><i /></div>
                  <div className="event-copy"><div className="event-title-row"><h3>{event.title}</h3>{event.flexible && <span className="flexible-tag">調整可</span>}</div><p>⌖ {event.name}・{event.area}</p></div>
                  <button className="delete-button" onClick={() => setEvents(current => current.filter(item => item.id !== event.id))} aria-label={`${event.title}を削除`}>×</button>
                </article>
                {route && <div className={`travel-row ${route.tight ? "warning" : ""}`}><span className="travel-icon">↳</span><span>公共交通で約{route.minutes}分</span><span className="travel-dots" /><strong>{route.tight ? (route.gap < route.minutes ? `不足 ${route.minutes - route.gap}分` : `余裕 ${route.gap - route.minutes}分`) : `空き ${route.gap}分`}</strong></div>}
              </div>;
            })}
          </div>
        </div>

        <div className="map-panel">
          <div className="map-surface">
            <div className="map-grid" /><div className="water water-one" /><div className="water water-two" /><div className="road road-one" /><div className="road road-two" /><div className="road road-three" />
            <span className="area-label area-yokohama">横浜</span><span className="area-label area-shibuya">渋谷</span><span className="area-label area-shinjuku">新宿</span><span className="area-label area-tokyo">東京</span><span className="area-label area-bay">東京湾</span>
            <svg className="route-layer" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">{routes.map((route, index) => {
              const from = mapPoint(route.from), to = mapPoint(route.to);
              return <line key={`${route.from.id}-${route.to.id}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} className={route.tight ? "route-warning" : ""} style={{ animationDelay: `${index * 120}ms` }} />;
            })}</svg>
            {dayEvents.map((event, index) => { const point = mapPoint(event); return <button className={`map-pin category-${event.category}`} key={event.id} style={{ left: `${point.x}%`, top: `${point.y}%` }} title={`${index + 1}. ${event.title}`}><span>{index + 1}</span><em>{event.start}</em></button>; })}
            <div className="map-legend"><span><i className="legend-route" />移動ルート</span><span><i className="legend-alert" />要確認</span></div>
          </div>
          <div className="insight-card"><div className="insight-icon">!</div><div><p className="eyebrow">ROUTE CHECK</p><h2>{summary.tightRoutes.length ? `${summary.tightRoutes.length}件の予定を確認してください` : "無理のない移動プランです"}</h2>
            {summary.tightRoutes.length ? summary.tightRoutes.map(route => <p key={`${route.from.id}-alert`}><strong>{route.from.area} → {route.to.area}</strong> は、移動を含めると{Math.abs(route.gap - route.minutes)}分{route.gap >= route.minutes ? "しか余裕がありません" : "不足しています"}。</p>) : <p>すべての予定間に、移動時間と10分以上の余裕があります。</p>}
          </div></div>
        </div>
      </section>
      {showForm && <EventForm selectedDate={selectedDate} onClose={() => setShowForm(false)} onSubmit={addEvent} />}
      {notice && <div className="toast" role="status">✓ {notice}</div>}
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="metric"><span>{label}</span><strong>{value}</strong></div>; }

function EventForm({ selectedDate, onClose, onSubmit }: { selectedDate: string; onClose: () => void; onSubmit: (event: ScheduleEvent) => void }) {
  const [title, setTitle] = useState(""), [date, setDate] = useState(selectedDate), [start, setStart] = useState("12:00"), [end, setEnd] = useState("13:00");
  const [category, setCategory] = useState<Category>("その他"), [flexible, setFlexible] = useState(true);
  const [placeQuery, setPlaceQuery] = useState(""), [selectedPlace, setSelectedPlace] = useState<PlaceSuggestion | null>(null);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]), [searching, setSearching] = useState(false), [placeError, setPlaceError] = useState("");

  useEffect(() => {
    if (selectedPlace?.name === placeQuery || placeQuery.trim().length < 2) {
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true);
      setPlaceError("");
      try {
        const response = await fetch(`/api/places?q=${encodeURIComponent(placeQuery.trim())}`, { signal: controller.signal });
        const data = await response.json() as { places?: PlaceSuggestion[]; error?: string };
        if (!response.ok) throw new Error(data.error);
        setSuggestions(data.places ?? []);
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          setSuggestions([]);
          setPlaceError("候補を取得できませんでした。もう一度入力してください。");
        }
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 350);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [placeQuery, selectedPlace]);

  function choosePlace(place: PlaceSuggestion) {
    setSelectedPlace(place);
    setPlaceQuery(place.name);
    setSuggestions([]);
    setPlaceError("");
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || toMinutes(end) <= toMinutes(start)) return;
    if (!selectedPlace) {
      setPlaceError("表示された候補から場所を選択してください。");
      return;
    }
    onSubmit({ id: `event-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`, title: title.trim(), date, start, end, category, flexible, name: selectedPlace.name, area: selectedPlace.area, lat: selectedPlace.lat, lng: selectedPlace.lng });
  }
  return <div className="modal-backdrop" onMouseDown={onClose}><form className="event-form" onSubmit={submit} onMouseDown={e => e.stopPropagation()}>
    <div className="form-heading"><div><p className="eyebrow">NEW SCHEDULE</p><h2>予定を追加</h2></div><button type="button" onClick={onClose} aria-label="閉じる">×</button></div>
    <label>予定名<input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="例：展示会を見に行く" required /></label>
    <div className="form-grid">
      <label>日付<input type="date" value={date} onChange={e => setDate(e.target.value)} required /></label>
      <label className="place-field">場所
        <div className={`place-search ${selectedPlace ? "selected" : ""}`}>
          <span className="search-mark" aria-hidden="true">⌕</span>
          <input
            value={placeQuery}
            onChange={e => { setPlaceQuery(e.target.value); setSelectedPlace(null); setSuggestions([]); setSearching(e.target.value.trim().length >= 2); setPlaceError(""); }}
            placeholder="駅名・施設名・住所を入力"
            autoComplete="off"
            role="combobox"
            aria-expanded={suggestions.length > 0}
            aria-controls="place-suggestions"
            aria-autocomplete="list"
            required
          />
          {searching && <span className="search-spinner" aria-label="検索中" />}
          {selectedPlace && <span className="selected-check" aria-label="場所を選択済み">✓</span>}
        </div>
        {suggestions.length > 0 && <div className="suggestion-list" id="place-suggestions" role="listbox">
          {suggestions.map(place => <button type="button" key={place.id} role="option" aria-selected="false" onClick={() => choosePlace(place)}>
            <span className="suggestion-icon">{place.type === "駅" ? "🚉" : place.type === "店舗" ? "⌂" : "⌖"}</span>
            <span className="suggestion-copy"><strong>{place.name}</strong><small>{place.type}・{place.address}</small></span>
          </button>)}
        </div>}
        {!searching && placeQuery.trim().length >= 2 && !selectedPlace && suggestions.length === 0 && !placeError && <span className="field-hint">該当する候補がありません。別の名称や住所をお試しください。</span>}
        {placeError && <span className="field-error" role="alert">{placeError}</span>}
        <span className="place-credit">検索データ © OpenStreetMap contributors</span>
      </label>
      <label>開始<input type="time" value={start} onChange={e => setStart(e.target.value)} required /></label><label>終了<input type="time" value={end} onChange={e => setEnd(e.target.value)} min={start} required /></label>
      <label>カテゴリ<select value={category} onChange={e => setCategory(e.target.value as Category)}>{categories.map(item => <option key={item}>{item}</option>)}</select></label>
      <label className="check-label"><input type="checkbox" checked={flexible} onChange={e => setFlexible(e.target.checked)} /><span>時間・場所を調整できる予定</span></label>
    </div>
    <div className="form-actions"><button type="button" className="secondary-button" onClick={onClose}>キャンセル</button><button className="submit-button">予定を追加</button></div>
  </form></div>;
}
