const beadRanges = { small: [0, 500], medium: [501, 2000], large: [2001, 5000], huge: [5001, 32400] };
const colorRanges = { few: [1, 5], medium: [6, 15], many: [16, 291] };
const continuityRanges = { scattered: [0, 49], mixed: [50, 79], continuous: [80, 100] };
function patternMetrics(project) {
  let beads = 0, adjacent = 0, same = 0;
  const colors = new Set();
  project.cells.forEach((id, i) => {
    if (!id) return;
    beads++; colors.add(id);
    const neighbors = [];
    if (i % project.width < project.width - 1) neighbors.push(i + 1);
    if (i + project.width < project.cells.length) neighbors.push(i + project.width);
    for (const n of neighbors) if (project.cells[n]) { adjacent++; if (project.cells[n] === id) same++; }
  });
  return { beads, colors: colors.size, continuity: adjacent ? Math.round(100 * same / adjacent) : 0 };
}
function parseFilters(params, { admin = false } = {}) {
  const result = {};
  for (const [name, allowed] of Object.entries({ beads: Object.keys(beadRanges), colors: Object.keys(colorRanges), continuity: Object.keys(continuityRanges), sort: ['new', 'small', 'colors', 'continuous'], ...(admin ? { status: ['all', 'published', 'hidden'] } : {}) })) {
    const value = params.get(name);
    if (value && !allowed.includes(value)) throw Object.assign(new Error('筛选参数无效。'), { status: 400 });
    if (value) result[name] = value;
  }
  return result;
}
module.exports = { patternMetrics, parseFilters, beadRanges, colorRanges, continuityRanges };
