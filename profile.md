# Wakatime

<!--CUSTOM_WAKA_START-->

const fmt = (s) => {
  if (s == null || s === 0) return '0 mins'
  const h = Math.floor(s / 3600)
  const m = Math.round((s % 3600) / 60)
  if (h > 0) return m > 0 ? h + ' hrs ' + m + ' mins' : h + ' hrs'
  return m + ' mins'
}

const renderList = (arr, n) => {
  if (!arr || arr.length === 0) return '- no data yet'
  return arr
    .slice(0, n)
    .map((x) => '- **' + x.name + '** — ' + fmt(x.time))
    .join('\n')
}

const weekTotal = fmt(waka.week ? waka.week.time : null)
const allTotal = fmt(waka.all ? waka.all.time : null)
const weekLangs = renderList(languages.week, 5)
const weekEditors = renderList(editors.week, 5)
const weekProjects = renderList(projects.week, 5)
const allLangs = renderList(languages.all, 5)

<!--CUSTOM_WAKA_END-->

## Last 7 days

- Total: **{weekTotal}**

### Languages

{weekLangs}

### Editors

{weekEditors}

### Projects

{weekProjects}

## All time

- Total: **{allTotal}**

### Languages

{allLangs}
