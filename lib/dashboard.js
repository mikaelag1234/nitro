import {load} from './square';
import {
  LOCATION_ID, TIME_ZONE, LAUNCH_DATE, NITRO, FEATURED,
  EQUIPMENT_COST, COST_PER_DRINK, NITRO_PRICE
} from './config';

const Q = 'ProductMixReport.items_sold_quantity';
const S = 'ProductMixReport.net_sales';
const T = 'ProductMixReport.local_created_at';
const r2 = (x) => Math.round(x * 100) / 100;
const sum = (rows, k) => rows.reduce((a, r) => a + (r[k] || 0), 0);

// "local_created_at" holds store-local time, so queries use UTC to avoid shifting it twice.
function range(granularity) {
  const td = {dimension: T, dateRange: [LAUNCH_DATE, '2027-12-31']};
  if (granularity) td.granularity = granularity;
  return td;
}
const atStore = {member: 'ProductMixReport.location_id', operator: 'equals', values: [LOCATION_ID]};

export function localNow(now = new Date()) {
  const today = new Intl.DateTimeFormat('en-CA', {timeZone: TIME_ZONE}).format(now);
  const hour = Number(new Intl.DateTimeFormat('en-GB', {timeZone: TIME_ZONE, hour: '2-digit', hourCycle: 'h23'}).format(now));
  const yday = new Date(Date.parse(today + 'T00:00:00Z') - 864e5).toISOString().slice(0, 10);
  return {today, yday, hour};
}

export async function getDashboard() {
  const [nitroRaw, storeRaw, trioRaw] = await Promise.all([
    load({
      measures: [Q, S],
      timeDimensions: [range('hour')],
      filters: [atStore, {member: 'ProductMixReport.item_name', operator: 'equals', values: [NITRO]}],
      timezone: 'UTC', limit: 5000
    }),
    load({
      measures: [Q, S],
      timeDimensions: [range('day')],
      filters: [atStore],
      timezone: 'UTC', limit: 5000
    }),
    load({
      measures: [Q, S],
      dimensions: ['ProductMixReport.item_name'],
      timeDimensions: [range('day')],
      filters: [atStore, {member: 'ProductMixReport.item_name', operator: 'equals', values: FEATURED.map((f) => f.item)}],
      timezone: 'UTC', limit: 5000
    })
  ]);

  const hourly = nitroRaw.map((r) => {
    const ts = String(r[T + '.hour'] || r[T]);
    return {date: ts.slice(0, 10), hour: Number(ts.slice(11, 13)), units: Number(r[Q]) || 0, net_sales: Number(r[S]) || 0};
  });
  const store = storeRaw.map((r) => ({date: String(r[T + '.day'] || r[T]).slice(0, 10), net_sales: Number(r[S]) || 0}));
  const trio = trioRaw.map((r) => ({
    item: r['ProductMixReport.item_name'],
    date: String(r[T + '.day'] || r[T]).slice(0, 10),
    units: Number(r[Q]) || 0,
    net_sales: Number(r[S]) || 0
  }));

  return compute({hourly, store, trio});
}

export function compute({hourly, store, trio}, now = new Date()) {
  const {today, yday, hour} = localNow(now);

  // Nitro headline numbers
  const t = hourly.filter((r) => r.date === today);
  const y = hourly.filter((r) => r.date === yday);
  const days = {};
  hourly.forEach((r) => { days[r.date] = (days[r.date] || 0) + r.units; });
  let bestDate = null, bestUnits = 0;
  Object.keys(days).forEach((k) => { if (days[k] > bestUnits) { bestUnits = days[k]; bestDate = k; } });
  const nitroSales = sum(hourly, 'net_sales');
  const storeSales = sum(store, 'net_sales');
  const launchUnits = sum(hourly, 'units');

  const nitro = {
    today_units: sum(t, 'units'),
    today_sales: r2(sum(t, 'net_sales')),
    yday_same_time_units: sum(y.filter((r) => r.hour <= hour), 'units'),
    yday_units: sum(y, 'units'),
    yday_sales: r2(sum(y, 'net_sales')),
    launch_units: launchUnits,
    launch_sales: r2(nitroSales),
    best_units: bestUnits,
    best_date: bestDate,
    store_share_pct: storeSales ? Math.round(nitroSales / storeSales * 1000) / 10 : null
  };

  // Nitro by day, launch to today, zero days filled in
  const daily = [];
  for (let ms = Date.parse(LAUNCH_DATE + 'T00:00:00Z'); ; ms += 864e5) {
    const k = new Date(ms).toISOString().slice(0, 10);
    if (k > today) break;
    const rows = hourly.filter((r) => r.date === k);
    daily.push({date: k, units: sum(rows, 'units'), net_sales: r2(sum(rows, 'net_sales')), is_today: k === today});
  }

  // Nitro today vs yesterday by hour
  let lo = 8, hi = 17;
  hourly.forEach((r) => { if (r.date === today || r.date === yday) { lo = Math.min(lo, r.hour); hi = Math.max(hi, r.hour); } });
  const todayHourly = [];
  for (let h = lo; h <= hi; h++) {
    const pick = (d) => sum(hourly.filter((r) => r.date === d && r.hour === h), 'units');
    todayHourly.push({hour: h, today: pick(today), yesterday: pick(yday)});
  }

  // Three featured drinks
  const featured = FEATURED.map((f) => {
    const rows = trio.filter((r) => r.item === f.item);
    const td = rows.filter((r) => r.date === today);
    const yd = rows.filter((r) => r.date === yday);
    return {
      key: f.key, label: f.label, short: f.short,
      units: sum(td, 'units'), net_sales: r2(sum(td, 'net_sales')),
      yday_units: sum(yd, 'units'), yday_sales: r2(sum(yd, 'net_sales')),
      launch_units: sum(rows, 'units'), launch_sales: r2(sum(rows, 'net_sales'))
    };
  });
  const featuredTotal = {
    units: sum(featured, 'units'), net_sales: r2(sum(featured, 'net_sales')),
    yday_units: sum(featured, 'yday_units'), yday_sales: r2(sum(featured, 'yday_sales'))
  };
  const byLaunch = featured.slice().sort((a, b) => b.launch_units - a.launch_units);
  const nitroRank = byLaunch.findIndex((f) => f.key === 'nitro') + 1;
  const byToday = featured.slice().sort((a, b) => b.units - a.units);
  const leader = !byToday[0].units ? null : (byToday[1] && byToday[1].units === byToday[0].units ? 'Tied' : byToday[0].short);

  // Payback: nitro sales only
  const margin = r2(NITRO_PRICE - COST_PER_DRINK);
  const paid = Math.max(0, r2(nitroSales - launchUnits * COST_PER_DRINK));
  const remaining = Math.max(0, r2(EQUIPMENT_COST - paid));
  const fullDays = Object.keys(days).filter((k) => k < today).map((k) => days[k]).filter((u) => u >= 5);
  const avg = fullDays.length ? Math.round(sum(fullDays.map((u) => ({u})), 'u') / fullDays.length * 10) / 10 : null;
  const toGo = Math.ceil(remaining / margin);
  const daysToGo = avg ? Math.ceil(toGo / avg) : null;
  const payback = {
    equipment: EQUIPMENT_COST, cost_per_drink: COST_PER_DRINK, price: NITRO_PRICE, margin_per_drink: margin,
    breakeven_drinks: Math.ceil(EQUIPMENT_COST / margin),
    drinks_sold: launchUnits, paid_off: paid, remaining,
    pct_paid: Math.round(Math.min(1, paid / EQUIPMENT_COST) * 1000) / 10,
    drinks_to_go: toGo, avg_per_day: avg, days_to_go: daysToGo,
    payoff_date: daysToGo == null ? null : new Date(Date.parse(today + 'T00:00:00Z') + daysToGo * 864e5).toISOString().slice(0, 10)
  };

  return {fetched_at: now.toISOString(), today, nitro, daily, todayHourly, featured, featuredTotal, nitroRank, leader, byLaunch, payback};
}
