'use client';

import {useEffect, useState, useCallback} from 'react';
import {EQUIPMENT_LINES} from '../lib/config';

const REFRESH_MS = 5 * 60 * 1000;
const int = (v) => (v == null ? '—' : Math.round(v).toLocaleString('en-CA'));
const money = (v) => (v == null ? '—' : '$' + Number(v).toLocaleString('en-CA', {minimumFractionDigits: 2, maximumFractionDigits: 2}));
const pct = (v) => (v == null ? '—' : v.toFixed(1) + '%');
const day = (k, long) => (k ? new Date(k + 'T00:00:00Z').toLocaleDateString('en-CA', {timeZone: 'UTC', weekday: long ? 'short' : undefined, month: 'short', day: 'numeric'}) : '—');
const hourLabel = (h) => (h % 12 === 0 ? 12 : h % 12) + (h < 12 ? 'am' : 'pm');

export default function Page() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/data', {cache: 'no-store'});
      const body = await res.json();
      if (!res.ok || body.error) throw new Error(body.error || 'Could not load data');
      setData(body);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, REFRESH_MS);
    return () => clearInterval(id);
  }, [refresh]);

  const n = data?.nitro;
  const pb = data?.payback;
  const pace = n ? n.today_units - n.yday_same_time_units : 0;
  const paceWord = !n ? '—' : pace > 0 ? '▲ Ahead of' : pace < 0 ? '▼ Behind' : 'Level with';
  const paceClass = !n ? '' : pace > 0 ? 'up' : pace < 0 ? 'down' : '';

  return (
    <main className="wrap">
      <header>
        <h1>Nitro Salted Brown Butter Oat Latte</h1>
        <p className="sub">Purebread Mount Pleasant (5 E 5th Ave) · live from Square · $7.90 · refreshes every 5 minutes while open</p>
        {n && (
          <p className="take">
            Today it has sold <b>{int(n.today_units)}</b> so far, {paceWord.replace(/^[▲▼] /, '').toLowerCase()} yesterday&apos;s pace.
            Since launch on Nov 14 it&apos;s the <b>#{data.nitroRank}</b> of the three featured drinks at the store, with <b>{int(n.launch_units)}</b> sold.
          </p>
        )}
        <div className="status mt">
          <span>{loading ? 'Updating…' : data ? `Updated ${new Date(data.fetched_at).toLocaleTimeString('en-CA', {timeZone: 'America/Vancouver', hour: 'numeric', minute: '2-digit'})}` : 'Loading…'}</span>
          <button onClick={refresh} disabled={loading}>Refresh now</button>
        </div>
      </header>

      {error && <div className="error">Couldn&apos;t load from Square: {error}</div>}

      {data && (
        <>
          <section className="grid">
            <Card label="Sold today" big={int(n.today_units)}>
              <span className={paceClass}>{paceWord}</span> yesterday&apos;s {int(n.yday_same_time_units)} by this hour
            </Card>
            <Card label="Net sales today" big={money(n.today_sales)}>Yesterday&apos;s full day: {money(n.yday_sales)}</Card>
            <Card label="Sold since launch (Nov 14)" big={int(n.launch_units)}>{money(n.launch_sales)} in net sales</Card>
            <Card label="Best day so far" big={int(n.best_units)}>on {day(n.best_date, true)}</Card>
            <Card label="Share of store net sales" big={pct(n.store_share_pct)}>of everything sold at Mount Pleasant since Nov 14</Card>
          </section>

          <section>
            <h2>Today at Mount Pleasant: the three featured drinks</h2>
            <p className="note">Leading today: <b>{data.leader || 'none sold yet today'}</b></p>
            <div className="grid mt">
              {data.featured.map((f) => (
                <Card key={f.key} label={f.label} big={int(f.units)}>
                  {money(f.net_sales)} net sales · yesterday {int(f.yday_units)}
                </Card>
              ))}
            </div>
            <div className="card mt">
              <div className="label">Total of all three today</div>
              <span className="big">{int(data.featuredTotal.units)} drinks · {money(data.featuredTotal.net_sales)}</span>
              <div className="delta">Yesterday&apos;s full day: {int(data.featuredTotal.yday_units)} drinks · {money(data.featuredTotal.yday_sales)}</div>
            </div>
          </section>

          <section>
            <h2>Paying off the nitro equipment</h2>
            <p className="note">
              Every nitro sold at {money(pb.price)} costs {money(pb.cost_per_drink)} to make, leaving {money(pb.margin_per_drink)} toward
              the {money(pb.equipment)} equipment investment. Only nitro sales count.
            </p>
            <div className="card mt">
              <div className="row">
                <div><div className="label">Paid off so far</div><span className="big">{money(pb.paid_off)}</span></div>
                <div className="right"><div className="label">Still to go</div><span className="big">{money(pb.remaining)}</span></div>
              </div>
              <div className="bar" role="img" aria-label={`${pct(pb.pct_paid)} of the equipment paid off`}>
                <div style={{width: Math.max(1, pb.pct_paid) + '%'}} />
              </div>
              <div className="delta">{pct(pb.pct_paid)} paid off, from {int(pb.drinks_sold)} nitros sold since Nov 14</div>
            </div>
            <div className="grid mt">
              <Card label="Drinks to break even" big={int(pb.breakeven_drinks)}>total, at full price</Card>
              <Card label="Drinks still needed" big={int(pb.drinks_to_go)}>from here</Card>
              <Card label="Current pace" big={pb.avg_per_day == null ? '—' : String(pb.avg_per_day)}>a day, average of full days it was on (5+ sold)</Card>
              <Card label="Paid off around" big={day(pb.payoff_date)}>{int(pb.days_to_go)} more days at this pace</Card>
            </div>
            <details className="mt">
              <summary>Equipment breakdown</summary>
              <ul>
                {EQUIPMENT_LINES.map(([name, cost]) => <li key={name}>{name}: {money(cost)}</li>)}
                <li>Total upfront: {money(pb.equipment)}</li>
              </ul>
              <p>Paid off so far is actual net sales from Square (discounts and comps count against it) minus the cost to make each drink. Drinks still needed assumes full price.</p>
            </details>
          </section>

          <section className="grid2">
            <div className="card">
              <h2>Units sold by day</h2>
              <p className="note">Today&apos;s bar is still filling in.</p>
              <Bars
                rows={data.daily.map((d) => ({label: day(d.date), value: d.units, faded: d.is_today, tip: `${day(d.date, true)}: ${int(d.units)} sold, ${money(d.net_sales)}`}))}
                aria="Nitro latte units sold per day since Nov 14"
              />
            </div>
            <div className="card">
              <h2>Today by hour vs yesterday</h2>
              <div className="legend"><span><i className="sw" />Today</span><span><i className="sw line" />Yesterday</span></div>
              <Bars
                rows={data.todayHourly.map((h) => ({label: hourLabel(h.hour), value: h.today, ref: h.yesterday, tip: `${hourLabel(h.hour)}: today ${h.today}, yesterday ${h.yesterday}`}))}
                aria="Nitro latte units sold per hour today, with yesterday as markers"
                hideZeroLabels
              />
            </div>
          </section>

          <section className="card">
            <h2>Featured drinks at Mount Pleasant since Nov 14</h2>
            <p className="note">Units sold, with net sales. Nitro is highlighted.</p>
            <Ranking rows={data.byLaunch} />
          </section>

          <details>
            <summary>How these numbers work</summary>
            <ul>
              <li>Net sales are after discounts and comps, before tax and tips.</li>
              <li>Hours and days use the time each order was opened at the store, Vancouver time.</li>
              <li>No nitro sold on Nov 15, so it was likely off the menu that day.</li>
              <li>Square&apos;s reporting usually trails the till by a few minutes.</li>
            </ul>
          </details>
        </>
      )}
    </main>
  );
}

function Card({label, big, children}) {
  return (
    <div className="card">
      <div className="label">{label}</div>
      <span className="big">{big}</span>
      <div className="delta">{children}</div>
    </div>
  );
}

function Bars({rows, aria, hideZeroLabels}) {
  const [tip, setTip] = useState(null);
  const W = 600, H = 250, m = {t: 18, r: 6, b: 26, l: 34};
  const max = Math.max(1, ...rows.map((r) => Math.max(r.value, r.ref || 0)));
  const step = niceStep(max);
  const top = Math.ceil((max * 1.1) / step) * step;
  const ticks = [];
  for (let v = 0; v <= top; v += step) ticks.push(v);
  const y = (v) => H - m.b - (v / top) * (H - m.t - m.b);
  const band = (W - m.l - m.r) / rows.length;
  const bw = band * 0.7;
  const every = Math.max(1, Math.ceil(rows.length / 10));

  return (
    <div className="chart" onMouseLeave={() => setTip(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={aria}>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={m.l} x2={W - m.r} y1={y(v)} y2={y(v)} stroke="var(--line)" />
            <text x={m.l - 6} y={y(v) + 4} textAnchor="end">{v}</text>
          </g>
        ))}
        {rows.map((r, i) => {
          const x = m.l + i * band + (band - bw) / 2;
          return (
            <g key={i}
              onMouseMove={(e) => {
                const box = e.currentTarget.ownerSVGElement.getBoundingClientRect();
                setTip({x: e.clientX - box.left, y: e.clientY - box.top, text: r.tip});
              }}>
              <rect x={m.l + i * band} y={m.t} width={band} height={H - m.t - m.b} fill="transparent" />
              <rect x={x} y={y(r.value)} width={bw} height={y(0) - y(r.value)} rx="2" fill="var(--accent)" opacity={r.faded ? 0.5 : 1} />
              {r.ref != null && <line x1={x - 2} x2={x + bw + 2} y1={y(r.ref)} y2={y(r.ref)} stroke="var(--muted-bar)" strokeWidth="3" strokeLinecap="round" />}
              {(!hideZeroLabels || r.value > 0) && (
                <text className="val" x={x + bw / 2} y={Math.min(y(r.value), r.ref != null ? y(r.ref) : y(r.value)) - 5} textAnchor="middle">{r.value}</text>
              )}
              {i % every === 0 && <text x={x + bw / 2} y={H - 8} textAnchor="middle">{r.label}</text>}
            </g>
          );
        })}
      </svg>
      {tip && <div className="tip" style={{left: Math.min(tip.x + 12, 420), top: Math.max(0, tip.y - 30)}}>{tip.text}</div>}
    </div>
  );
}

function Ranking({rows}) {
  const W = 600, rowH = 44;
  const max = Math.max(1, ...rows.map((r) => r.launch_units));
  const barMax = W - 150;
  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${rows.length * rowH}`} role="img" aria-label="Featured drinks units sold since Nov 14, nitro highlighted">
        {rows.map((r, i) => {
          const w = Math.max(2, (r.launch_units / max) * barMax);
          const hi = r.key === 'nitro';
          return (
            <g key={r.key} transform={`translate(0,${i * rowH})`}>
              <text className={'name' + (hi ? ' hi' : '')} x="0" y="13">{r.label}</text>
              <rect x="0" y="19" width={w} height="14" rx="2" fill={hi ? 'var(--accent)' : 'var(--muted-bar)'} />
              <text className="val" x={w + 6} y="31">{int(r.launch_units)} · {money(r.launch_sales)}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function niceStep(max) {
  const raw = max / 4;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}
