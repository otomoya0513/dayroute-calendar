"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Category = "仕事" | "買い物" | "食事" | "イベント" | "その他";
type ViewMode = "day" | "week" | "month" | "year";
type Place = { name: string; area: string; lat: number; lng: number };
type PlaceSuggestion = Place & { id: string; address: string; type: string };
type FavoritePlace = PlaceSuggestion & { label: string };
type ScheduleEvent = Place & { id: string; title: string; date: string; start: string; end: string; category: Category; flexible: boolean };
type RouteLeg = { id: string; from: Place; to: Place; minutes: number; gap: number | null; tight: boolean; isStart: boolean };

const seedPlaces: Place[] = [
  { name: "新宿駅", area: "新宿", lat: 35.6896, lng: 139.7006 },
  { name: "渋谷駅", area: "渋谷", lat: 35.658, lng: 139.7016 },
  { name: "東京駅", area: "丸の内", lat: 35.6812, lng: 139.7671 },
  { name: "横浜駅", area: "横浜", lat: 35.4657, lng: 139.6223 },
];
const categories: Category[] = ["仕事", "買い物", "食事", "イベント", "その他"];
const viewModes: { id: ViewMode; label: string }[] = [
  { id: "day", label: "日" }, { id: "week", label: "週" }, { id: "month", label: "月" }, { id: "year", label: "年" },
];

function isoDate(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function dateFromIso(value: string) { return new Date(`${value}T12:00:00+09:00`); }
function addDays(value: string, amount: number) { const date = dateFromIso(value); date.setDate(date.getDate() + amount); return date; }
function startOfWeek(value: string) { const date = dateFromIso(value); const diff = (date.getDay() + 6) % 7; date.setDate(date.getDate() - diff); return date; }
function toMinutes(value: string) { const [hour, minute] = value.split(":").map(Number); return hour * 60 + minute; }
function formatDay(value: string) { return new Intl.DateTimeFormat("ja-JP", { month: "long", day: "numeric", weekday: "short", timeZone: "Asia/Tokyo" }).format(dateFromIso(value)); }
function seedEvents(date: string): ScheduleEvent[] {
  return [
    { id: "seed-1", title: "午前の買い物", date, start: "10:00", end: "11:00", category: "買い物", flexible: true, ...seedPlaces[3] },
    { id: "seed-2", title: "期間限定イベント", date, start: "13:00", end: "15:00", category: "イベント", flexible: false, ...seedPlaces[1] },
    { id: "seed-3", title: "友人と夕食", date, start: "17:00", end: "18:15", category: "食事", flexible: true, ...seedPlaces[0] },
    { id: "seed-4", title: "夜のライブ", date, start: "19:00", end: "21:00", category: "イベント", flexible: false, ...seedPlaces[1] },
  ];
}
function haversine(a: Place, b: Place) {
  const r = 6371, rad = Math.PI / 180, dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(x));
}
function travelMinutes(a: Place, b: Place) { return Math.max(8, Math.round(haversine(a, b) * 1.15 + 12)); }
function mapPoint(place: Place, points: Place[]) {
  const lngs = points.map(point => point.lng), lats = points.map(point => point.lat);
  let minLng = Math.min(...lngs), maxLng = Math.max(...lngs), minLat = Math.min(...lats), maxLat = Math.max(...lats);
  if (maxLng - minLng < .08) { minLng -= .04; maxLng += .04; }
  if (maxLat - minLat < .08) { minLat -= .04; maxLat += .04; }
  return { x: 10 + ((place.lng - minLng) / (maxLng - minLng)) * 80, y: 10 + ((maxLat - place.lat) / (maxLat - minLat)) * 80 };
}

export default function Home() {
  const [selectedDate, setSelectedDate] = useState("2000-01-01");
  const [viewMode, setViewMode] = useState<ViewMode>("day");
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [favorites, setFavorites] = useState<FavoritePlace[]>([]);
  const [startLocation, setStartLocation] = useState<PlaceSuggestion | null>(null);
  const [ready, setReady] = useState(false), [showForm, setShowForm] = useState(false), [showPlaces, setShowPlaces] = useState(false), [notice, setNotice] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const today = isoDate(new Date());
      setSelectedDate(today);
      const storedEvents = window.localStorage.getItem("dayroute-events");
      const storedFavorites = window.localStorage.getItem("dayroute-favorites");
      const storedStart = window.localStorage.getItem("dayroute-start-location");
      setEvents(storedEvents ? JSON.parse(storedEvents) : seedEvents(today));
      setFavorites(storedFavorites ? JSON.parse(storedFavorites) : []);
      setStartLocation(storedStart ? JSON.parse(storedStart) : null);
      setReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => { if (ready) window.localStorage.setItem("dayroute-events", JSON.stringify(events)); }, [events, ready]);
  useEffect(() => { if (ready) window.localStorage.setItem("dayroute-favorites", JSON.stringify(favorites)); }, [favorites, ready]);
  useEffect(() => { if (!ready) return; if (startLocation) window.localStorage.setItem("dayroute-start-location", JSON.stringify(startLocation)); else window.localStorage.removeItem("dayroute-start-location"); }, [startLocation, ready]);

  const dayEvents = useMemo(() => events.filter(event => event.date === selectedDate).sort((a, b) => a.start.localeCompare(b.start)), [events, selectedDate]);
  const eventRoutes = useMemo<RouteLeg[]>(() => dayEvents.slice(0, -1).map((from, index) => {
    const to = dayEvents[index + 1], minutes = travelMinutes(from, to), gap = toMinutes(to.start) - toMinutes(from.end);
    return { id: `${from.id}-${to.id}`, from, to, minutes, gap, tight: gap < minutes + 10, isStart: false };
  }), [dayEvents]);
  const startRoute = useMemo<RouteLeg | null>(() => startLocation && dayEvents[0] ? { id: `start-${dayEvents[0].id}`, from: startLocation, to: dayEvents[0], minutes: travelMinutes(startLocation, dayEvents[0]), gap: null, tight: false, isStart: true } : null, [startLocation, dayEvents]);
  const routes = useMemo(() => startRoute ? [startRoute, ...eventRoutes] : eventRoutes, [startRoute, eventRoutes]);
  const summary = useMemo(() => {
    const travel = routes.reduce((sum, route) => sum + route.minutes, 0), distance = routes.reduce((sum, route) => sum + haversine(route.from, route.to), 0), tightRoutes = eventRoutes.filter(route => route.tight), areas = new Set(dayEvents.map(event => event.area)).size;
    const density = Math.min(100, Math.round(dayEvents.length * 8 + travel * .35 + areas * 5 + tightRoutes.length * 20));
    return { travel, distance: Math.round(distance), tightRoutes, density };
  }, [dayEvents, routes, eventRoutes]);
  const densityLabel = summary.density >= 75 ? "要調整" : summary.density >= 50 ? "やや高密度" : "余裕あり";
  const weekStrip = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(selectedDate, index - 3)), [selectedDate]);

  function flash(message: string) { setNotice(message); window.setTimeout(() => setNotice(""), 2400); }
  function addEvent(event: ScheduleEvent) { setEvents(current => [...current, event]); setShowForm(false); flash("予定を追加しました"); }
  function saveFavorite(place: PlaceSuggestion, label: string) {
    setFavorites(current => [...current.filter(item => item.id !== place.id), { ...place, label: label.trim() || place.name }]); flash("お気に入り地点を保存しました");
  }
  function openDay(date: string) { setSelectedDate(date); setViewMode("day"); }
  function movePeriod(amount: number) {
    const date = dateFromIso(selectedDate);
    if (viewMode === "day" || viewMode === "week") date.setDate(date.getDate() + amount * 7);
    if (viewMode === "month") date.setMonth(date.getMonth() + amount);
    if (viewMode === "year") date.setFullYear(date.getFullYear() + amount);
    setSelectedDate(isoDate(date));
  }
  function periodTitle() {
    const date = dateFromIso(selectedDate);
    if (viewMode === "week") { const start = startOfWeek(selectedDate), end = new Date(start); end.setDate(end.getDate() + 6); return `${start.getFullYear()}年${start.getMonth() + 1}月${start.getDate()}日 — ${end.getMonth() + 1}月${end.getDate()}日`; }
    if (viewMode === "month") return `${date.getFullYear()}年${date.getMonth() + 1}月`;
    return `${date.getFullYear()}年`;
  }

  const mapPlaces: Place[] = [...dayEvents, ...(startLocation ? [startLocation] : [])];

  return <main className="app-shell">
    <header className="topbar">
      <a className="brand" href="#top"><span className="brand-mark"><span /></span><span>DayRoute</span></a>
      <nav className="nav-tabs"><button className="nav-tab active">プラン</button><button className="nav-tab">振り返り</button></nav>
      <div className="top-actions"><button className="place-button" onClick={() => setShowPlaces(true)}>☆ 登録地点</button><button className="add-button" onClick={() => setShowForm(true)}>＋ 予定を追加</button></div>
    </header>

    <section className="date-rail" id="top">
      {viewMode === "day" ? <>
        <button className="round-button" onClick={() => movePeriod(-1)} aria-label="前の週">‹</button>
        <div className="date-strip">{weekStrip.map(date => { const key = isoDate(date), count = events.filter(event => event.date === key).length; return <button key={key} className={`date-chip ${key === selectedDate ? "active" : ""}`} onClick={() => setSelectedDate(key)}><span>{new Intl.DateTimeFormat("ja-JP", { weekday: "short", timeZone: "Asia/Tokyo" }).format(date)}</span><strong>{date.getDate()}</strong><i className={count ? "has-events" : ""} /></button>; })}</div>
        <button className="round-button" onClick={() => movePeriod(1)} aria-label="次の週">›</button>
      </> : <div className="period-navigator"><button className="round-button" onClick={() => movePeriod(-1)} aria-label="前の期間">‹</button><strong>{periodTitle()}</strong><button className="round-button" onClick={() => movePeriod(1)} aria-label="次の期間">›</button></div>}
    </section>

    <section className="summary-bar">
      <div><p className="eyebrow">{viewMode === "day" ? "TODAY'S ROUTE" : "CALENDAR OVERVIEW"}</p><h1>{viewMode === "day" ? `${formatDay(selectedDate)}のプラン` : `${periodTitle()}の予定`}</h1></div>
      <div className="summary-side"><div className="view-switch" aria-label="表示単位">{viewModes.map(mode => <button key={mode.id} className={viewMode === mode.id ? "active" : ""} onClick={() => setViewMode(mode.id)}>{mode.label}</button>)}</div>
        {viewMode === "day" && <div className="summary-metrics"><Metric label="予定" value={`${dayEvents.length}件`} /><Metric label="移動" value={`約${summary.travel}分`} /><Metric label="距離" value={`約${summary.distance}km`} /><div className={`density-pill density-${densityLabel}`}><span>移動負荷</span><strong>{densityLabel}</strong><i style={{ width: `${Math.max(8, summary.density)}%` }} /></div></div>}
      </div>
    </section>

    {viewMode === "day" ? <section className="workspace">
      <div className="schedule-panel"><div className="panel-heading"><div><p className="eyebrow">SCHEDULE</p><h2>時間順の予定</h2></div><button className="icon-button" onClick={() => setShowForm(true)} aria-label="予定を追加">＋</button></div>
        <div className="timeline">
          {startLocation && <><div className="start-point-card"><span>S</span><div><small>START POINT</small><strong>{startLocation.name}</strong><p>{startLocation.address}</p></div><button onClick={() => setShowPlaces(true)}>変更</button></div>{startRoute && <TravelRow route={startRoute} />}</>}
          {!ready ? <p className="empty-state">予定を読み込んでいます…</p> : dayEvents.length === 0 ? <div className="empty-state"><span>◎</span><strong>この日の予定はありません</strong><p>場所のある予定を追加すると、移動ルートを確認できます。</p><button onClick={() => setShowForm(true)}>最初の予定を追加</button></div> : dayEvents.map((event, index) => <div className="timeline-group" key={event.id}><article className={`event-card category-${event.category}`}><div className="event-time"><strong>{event.start}</strong><span>{event.end}</span></div><div className="event-line"><i /></div><div className="event-copy"><div className="event-title-row"><h3>{event.title}</h3>{event.flexible && <span className="flexible-tag">調整可</span>}</div><p>⌖ {event.name}・{event.area}</p></div><button className="delete-button" onClick={() => setEvents(current => current.filter(item => item.id !== event.id))} aria-label={`${event.title}を削除`}>×</button></article>{eventRoutes[index] && <TravelRow route={eventRoutes[index]} />}</div>)}
        </div>
      </div>
      <div className="map-panel"><div className="map-surface"><div className="map-grid" /><div className="water water-one" /><div className="water water-two" /><div className="road road-one" /><div className="road road-two" /><div className="road road-three" />
        {mapPlaces.length > 0 && <svg className="route-layer" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">{routes.map((route, index) => { const from = mapPoint(route.from, mapPlaces), to = mapPoint(route.to, mapPlaces); return <line key={route.id} x1={from.x} y1={from.y} x2={to.x} y2={to.y} className={route.tight ? "route-warning" : ""} style={{ animationDelay: `${index * 120}ms` }} />; })}</svg>}
        {startLocation && mapPlaces.length > 0 && (() => { const point = mapPoint(startLocation, mapPlaces); return <button className="map-pin start-pin" style={{ left: `${point.x}%`, top: `${point.y}%` }} title={`開始地点：${startLocation.name}`}><span>S</span><em>START</em></button>; })()}
        {dayEvents.map((event, index) => { const point = mapPoint(event, mapPlaces); return <button className={`map-pin category-${event.category}`} key={event.id} style={{ left: `${point.x}%`, top: `${point.y}%` }} title={`${index + 1}. ${event.title}`}><span>{index + 1}</span><em>{event.start}</em></button>; })}
        <div className="map-legend"><span><i className="legend-route" />移動ルート</span><span><i className="legend-alert" />要確認</span></div></div>
        <div className="insight-card"><div className="insight-icon">!</div><div><p className="eyebrow">ROUTE CHECK</p><h2>{summary.tightRoutes.length ? `${summary.tightRoutes.length}件の予定を確認してください` : "無理のない移動プランです"}</h2>{summary.tightRoutes.length ? summary.tightRoutes.map(route => <p key={route.id}><strong>{route.from.area} → {route.to.area}</strong> は、移動を含めると{Math.abs((route.gap ?? 0) - route.minutes)}分{(route.gap ?? 0) >= route.minutes ? "しか余裕がありません" : "不足しています"}。</p>) : <p>{startLocation ? "開始地点を含め、" : ""}すべての予定間に無理のない移動時間があります。</p>}</div></div>
      </div>
    </section> : <CalendarOverview mode={viewMode} selectedDate={selectedDate} events={events} onOpenDay={openDay} onOpenMonth={(date) => { setSelectedDate(date); setViewMode("month"); }} />}

    {showForm && <EventForm selectedDate={selectedDate} favorites={favorites} onClose={() => setShowForm(false)} onSubmit={addEvent} onSaveFavorite={saveFavorite} />}
    {showPlaces && <PlaceManager startLocation={startLocation} favorites={favorites} onClose={() => setShowPlaces(false)} onSetStart={(place) => { setStartLocation(place); flash(place ? "開始地点を設定しました" : "開始地点を解除しました"); }} onSaveFavorite={saveFavorite} onRemoveFavorite={(id) => setFavorites(current => current.filter(item => item.id !== id))} />}
    {notice && <div className="toast" role="status">✓ {notice}</div>}
  </main>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="metric"><span>{label}</span><strong>{value}</strong></div>; }
function TravelRow({ route }: { route: RouteLeg }) { return <div className={`travel-row ${route.tight ? "warning" : ""}`}><span className="travel-icon">↳</span><span>{route.isStart ? "最初の予定まで" : "公共交通で"}約{route.minutes}分</span><span className="travel-dots" />{route.gap !== null && <strong>{route.tight ? (route.gap < route.minutes ? `不足 ${route.minutes - route.gap}分` : `余裕 ${route.gap - route.minutes}分`) : `空き ${route.gap}分`}</strong>}</div>; }

function CalendarOverview({ mode, selectedDate, events, onOpenDay, onOpenMonth }: { mode: Exclude<ViewMode, "day">; selectedDate: string; events: ScheduleEvent[]; onOpenDay: (date: string) => void; onOpenMonth: (date: string) => void }) {
  const selected = dateFromIso(selectedDate);
  if (mode === "week") {
    const start = startOfWeek(selectedDate), days = Array.from({ length: 7 }, (_, index) => { const date = new Date(start); date.setDate(date.getDate() + index); return date; });
    return <section className="calendar-overview week-overview">{days.map(date => { const key = isoDate(date), items = events.filter(event => event.date === key).sort((a, b) => a.start.localeCompare(b.start)); return <article key={key} className="week-day"><button className="calendar-day-head" onClick={() => onOpenDay(key)}><span>{new Intl.DateTimeFormat("ja-JP", { weekday: "short" }).format(date)}</span><strong>{date.getDate()}</strong><small>{items.length}件</small></button><div>{items.map(event => <button key={event.id} className={`overview-event category-bg-${event.category}`} onClick={() => onOpenDay(key)}><time>{event.start}</time><strong>{event.title}</strong><span>{event.name}</span></button>)}{items.length === 0 && <p className="no-events">予定なし</p>}</div></article>; })}</section>;
  }
  if (mode === "month") {
    const first = new Date(selected.getFullYear(), selected.getMonth(), 1, 12), offset = (first.getDay() + 6) % 7, gridStart = new Date(first); gridStart.setDate(first.getDate() - offset);
    const days = Array.from({ length: 42 }, (_, index) => { const date = new Date(gridStart); date.setDate(date.getDate() + index); return date; });
    return <section className="calendar-overview month-overview"><div className="weekday-row">{["月","火","水","木","金","土","日"].map(day => <span key={day}>{day}</span>)}</div><div className="month-grid">{days.map(date => { const key = isoDate(date), items = events.filter(event => event.date === key).sort((a,b) => a.start.localeCompare(b.start)), outside = date.getMonth() !== selected.getMonth(); return <button key={key} className={`month-day ${outside ? "outside" : ""}`} onClick={() => onOpenDay(key)}><span>{date.getDate()}</span><div>{items.slice(0,3).map(event => <small className={`category-bg-${event.category}`} key={event.id}>{event.start} {event.title}</small>)}{items.length > 3 && <em>ほか{items.length - 3}件</em>}</div></button>; })}</div></section>;
  }
  const year = selected.getFullYear();
  return <section className="calendar-overview year-overview">{Array.from({ length: 12 }, (_, month) => { const monthEvents = events.filter(event => { const date = dateFromIso(event.date); return date.getFullYear() === year && date.getMonth() === month; }).sort((a,b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start)); const date = `${year}-${String(month + 1).padStart(2,"0")}-01`; return <article className="year-month" key={month}><button className="year-month-head" onClick={() => onOpenMonth(date)}><strong>{month + 1}月</strong><span>{monthEvents.length}件</span></button><div>{monthEvents.slice(0,4).map(event => <button key={event.id} onClick={() => onOpenDay(event.date)}><time>{Number(event.date.slice(8))}日</time><span>{event.title}</span></button>)}{monthEvents.length === 0 && <p>予定なし</p>}{monthEvents.length > 4 && <small>ほか{monthEvents.length - 4}件</small>}</div></article>; })}</section>;
}

function EventForm({ selectedDate, favorites, onClose, onSubmit, onSaveFavorite }: { selectedDate: string; favorites: FavoritePlace[]; onClose: () => void; onSubmit: (event: ScheduleEvent) => void; onSaveFavorite: (place: PlaceSuggestion, label: string) => void }) {
  const [title, setTitle] = useState(""), [date, setDate] = useState(selectedDate), [start, setStart] = useState("12:00"), [end, setEnd] = useState("13:00"), [category, setCategory] = useState<Category>("その他"), [flexible, setFlexible] = useState(true), [place, setPlace] = useState<PlaceSuggestion | null>(null), [error, setError] = useState("");
  function submit(event: FormEvent) { event.preventDefault(); if (!title.trim() || toMinutes(end) <= toMinutes(start)) return; if (!place) { setError("候補またはお気に入りから場所を選択してください。"); return; } onSubmit({ id: `event-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`, title: title.trim(), date, start, end, category, flexible, name: place.name, area: place.area, lat: place.lat, lng: place.lng }); }
  return <div className="modal-backdrop" onMouseDown={onClose}><form className="event-form" onSubmit={submit} onMouseDown={event => event.stopPropagation()}><div className="form-heading"><div><p className="eyebrow">NEW SCHEDULE</p><h2>予定を追加</h2></div><button type="button" onClick={onClose} aria-label="閉じる">×</button></div>
    <label>予定名<input autoFocus value={title} onChange={event => setTitle(event.target.value)} placeholder="例：展示会を見に行く" required /></label><div className="form-grid"><label>日付<input type="date" value={date} onChange={event => setDate(event.target.value)} required /></label><div className="place-field-wrap"><PlaceSearch label="場所" value={place} onSelect={(selected) => { setPlace(selected); setError(""); }} />{favorites.length > 0 && <div className="favorite-chips">{favorites.map(item => <button type="button" key={item.id} onClick={() => setPlace(item)}>☆ {item.label}</button>)}</div>}{place && !favorites.some(item => item.id === place.id) && <button type="button" className="quick-favorite" onClick={() => onSaveFavorite(place, place.name)}>☆ この場所をお気に入りに追加</button>}{error && <span className="field-error">{error}</span>}</div><label>開始<input type="time" value={start} onChange={event => setStart(event.target.value)} required /></label><label>終了<input type="time" value={end} onChange={event => setEnd(event.target.value)} min={start} required /></label><label>カテゴリ<select value={category} onChange={event => setCategory(event.target.value as Category)}>{categories.map(item => <option key={item}>{item}</option>)}</select></label><label className="check-label"><input type="checkbox" checked={flexible} onChange={event => setFlexible(event.target.checked)} /><span>時間・場所を調整できる予定</span></label></div>
    <div className="form-actions"><button type="button" className="secondary-button" onClick={onClose}>キャンセル</button><button className="submit-button">予定を追加</button></div></form></div>;
}

function PlaceManager({ startLocation, favorites, onClose, onSetStart, onSaveFavorite, onRemoveFavorite }: { startLocation: PlaceSuggestion | null; favorites: FavoritePlace[]; onClose: () => void; onSetStart: (place: PlaceSuggestion | null) => void; onSaveFavorite: (place: PlaceSuggestion, label: string) => void; onRemoveFavorite: (id: string) => void }) {
  const [place, setPlace] = useState<PlaceSuggestion | null>(null), [label, setLabel] = useState("");
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="place-manager" onMouseDown={event => event.stopPropagation()}><div className="form-heading"><div><p className="eyebrow">SAVED PLACES</p><h2>開始地点・お気に入り</h2></div><button onClick={onClose} aria-label="閉じる">×</button></div>
    <section><h3>現在の開始地点</h3>{startLocation ? <div className="current-start"><span>S</span><div><strong>{startLocation.name}</strong><small>{startLocation.address}</small></div><button onClick={() => onSetStart(null)}>解除</button></div> : <p className="manager-empty">設定されていません。下から検索するか、お気に入りを選択してください。</p>}</section>
    <section><h3>お気に入り地点</h3>{favorites.length ? <div className="favorite-list">{favorites.map(item => <article key={item.id}><span>☆</span><div><strong>{item.label}</strong><small>{item.name}・{item.address}</small></div><button onClick={() => onSetStart(item)}>開始地点にする</button><button className="remove-favorite" onClick={() => onRemoveFavorite(item.id)} aria-label={`${item.label}を削除`}>×</button></article>)}</div> : <p className="manager-empty">自宅や職場、よく使う駅を登録できます。</p>}</section>
    <section className="add-place-section"><h3>地点を検索</h3><PlaceSearch label="" value={place} onSelect={selected => { setPlace(selected); setLabel(selected?.name ?? ""); }} />{place && <div className="place-actions"><label>お気に入りの表示名<input value={label} onChange={event => setLabel(event.target.value)} placeholder="例：自宅" /></label><div><button onClick={() => onSetStart(place)} className="secondary-button">開始地点に設定</button><button onClick={() => onSaveFavorite(place, label)} className="submit-button">お気に入りに保存</button></div></div>}</section>
  </div></div>;
}

function PlaceSearch({ label, value, onSelect }: { label: string; value: PlaceSuggestion | null; onSelect: (place: PlaceSuggestion | null) => void }) {
  const [query, setQuery] = useState(value?.name ?? ""), [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]), [searching, setSearching] = useState(false), [error, setError] = useState("");
  useEffect(() => { if (!value) return; const timer = window.setTimeout(() => setQuery(value.name), 0); return () => window.clearTimeout(timer); }, [value]);
  useEffect(() => {
    if (value?.name === query || query.trim().length < 2) return;
    const controller = new AbortController(), timer = window.setTimeout(async () => { setSearching(true); setError(""); try { const response = await fetch(`/api/places?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal }); const data = await response.json() as { places?: PlaceSuggestion[]; error?: string }; if (!response.ok) throw new Error(data.error); setSuggestions(data.places ?? []); } catch (caught) { if ((caught as Error).name !== "AbortError") { setSuggestions([]); setError("候補を取得できませんでした。もう一度入力してください。"); } } finally { if (!controller.signal.aborted) setSearching(false); } }, 350);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query, value]);
  function choose(place: PlaceSuggestion) { onSelect(place); setQuery(place.name); setSuggestions([]); setError(""); }
  return <label className="place-field">{label}<div className={`place-search ${value ? "selected" : ""}`}><span className="search-mark">⌕</span><input value={query} onChange={event => { setQuery(event.target.value); onSelect(null); setSuggestions([]); setSearching(event.target.value.trim().length >= 2); setError(""); }} placeholder="駅名・施設名・住所を入力" autoComplete="off" role="combobox" aria-controls="place-search-results" aria-expanded={suggestions.length > 0} aria-autocomplete="list" />{searching && <span className="search-spinner" />}{value && <span className="selected-check">✓</span>}</div>{suggestions.length > 0 && <div className="suggestion-list" id="place-search-results" role="listbox">{suggestions.map(place => <button type="button" key={place.id} role="option" aria-selected="false" onClick={() => choose(place)}><span className="suggestion-icon">{place.type === "駅" ? "🚉" : "⌖"}</span><span className="suggestion-copy"><strong>{place.name}</strong><small>{place.type}・{place.address}</small></span></button>)}</div>}{!searching && query.trim().length >= 2 && !value && suggestions.length === 0 && !error && <span className="field-hint">該当する候補がありません。別の名称や住所をお試しください。</span>}{error && <span className="field-error">{error}</span>}<span className="place-credit">検索データ © OpenStreetMap contributors</span></label>;
}
