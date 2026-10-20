import { t, type Locale } from './i18n';
export type MarketFilters = { beads: string; colors: string; continuity: string };
export const emptyMarketFilters: MarketFilters = { beads: '', colors: '', continuity: '' };
export function ComplexityFilters({ value, onChange, locale }: { value: MarketFilters; onChange: (value: MarketFilters) => void; locale: Locale }) {
  return <div className="market-complexity-filters">
    <label>{t('marketFilter.beads', {}, locale)}<select value={value.beads} onChange={e => onChange({ ...value, beads: e.target.value })}>
      <option value="">{t('marketFilter.any', {}, locale)}</option>
      <option value="small">≤ 500</option><option value="medium">501–2,000</option><option value="large">2,001–5,000</option><option value="huge">&gt; 5,000</option>
    </select></label>
    <label>{t('marketFilter.colors', {}, locale)}<select value={value.colors} onChange={e => onChange({ ...value, colors: e.target.value })}>
      <option value="">{t('marketFilter.any', {}, locale)}</option><option value="few">≤ 5</option><option value="medium">6–15</option><option value="many">&gt; 15</option>
    </select></label>
    <label>{t('marketFilter.continuity', {}, locale)}<select value={value.continuity} onChange={e => onChange({ ...value, continuity: e.target.value })}>
      <option value="">{t('marketFilter.any', {}, locale)}</option>{(['scattered','mixed','continuous'] as const).map(key => <option key={key} value={key}>{t(`marketFilter.${key}`, {}, locale)}</option>)}
    </select></label>
    <p>{t('marketFilter.hint', {}, locale)}</p>
  </div>;
}
export function matchesComplexity(item: { beads: number; colors: number; continuity?: number }, filters: MarketFilters) {
  const ranges: Record<string, [number, number]> = { small: [0,500], medium: [501,2000], large: [2001,5000], huge: [5001,Infinity] };
  const colorRanges: Record<string, [number, number]> = { few: [0,5], medium: [6,15], many: [16,Infinity] };
  const continuityRanges: Record<string, [number, number]> = { scattered: [0,49], mixed: [50,79], continuous: [80,100] };
  return (!filters.beads || (item.beads >= ranges[filters.beads][0] && item.beads <= ranges[filters.beads][1]))
    && (!filters.colors || (item.colors >= colorRanges[filters.colors][0] && item.colors <= colorRanges[filters.colors][1]))
    && (!filters.continuity || (item.continuity !== undefined && item.continuity >= continuityRanges[filters.continuity][0] && item.continuity <= continuityRanges[filters.continuity][1]));
}
export function projectContinuity(project: { width: number; cells: Array<string | null> }) {
  let adjacent = 0, same = 0;
  project.cells.forEach((id, i) => {
    if (!id) return;
    for (const n of [i % project.width < project.width - 1 ? i + 1 : -1, i + project.width]) {
      if (project.cells[n]) { adjacent++; if (project.cells[n] === id) same++; }
    }
  });
  return adjacent ? Math.round(100 * same / adjacent) : 0;
}
