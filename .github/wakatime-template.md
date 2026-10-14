<!--
  Wakatime stats page. Template syntax (inline expression tokens plus CUSTOM_WAKA
  START/END code blocks) and the underlying rendering design are adapted from
  Twisuki/custom_waka_readme — https://github.com/Twisuki/custom_waka_readme
-->

# Wakatime

<!--CUSTOM_WAKA_START-->

const fmt = (s) => {
  const t = Math.max(0, Math.round(s || 0))
  const h = Math.floor(t / 3600)
  const m = Math.round((t % 3600) / 60)
  return h + ' hrs ' + m + ' mins'
}

const allTotal = allTime ? fmt(allTime.time) : 'n/a'

<!--CUSTOM_WAKA_END-->

Total time: **{allTotal}**

## Daily Trend ({last14.label})

<!--CUSTOM_WAKA_START-->

const ROWS = 4
const SPC = 4
const DBITS = [
  [1, 2, 4, 64],
  [8, 16, 32, 128],
]
const days = last14.days
const cols = days.length * SPC
const width = Math.ceil(cols / 2)
const dataPeak = days.length > 0 ? Math.max(...days.map((d) => d.time)) : 0
const peak = Math.max(1, dataPeak)
const heightOf = (v) => (v <= 0 ? 0 : Math.max(1, Math.round((v / peak) * ROWS * 4)))
const sample = (x) => {
  if (days.length === 0) return 0
  if (days.length === 1) return days[0].time
  const t = (x / (cols - 1)) * (days.length - 1)
  const i = Math.floor(t)
  const j = Math.min(days.length - 1, i + 1)
  return days[i].time + (days[j].time - days[i].time) * (t - i)
}
const graph = []
for (let r = 0; r < ROWS; r++) {
  let line = ''
  for (let c = 0; c < width; c++) {
    let bits = 0
    for (let col = 0; col < 2; col++) {
      const x = c * 2 + col
      if (x >= cols) continue
      const h = heightOf(sample(x))
      for (let k = 0; k < 4; k++) {
        if (h >= ROWS * 4 - (r * 4 + k)) bits |= DBITS[col][k]
      }
    }
    line += String.fromCharCode(0x2800 + bits)
  }
  graph.push(line)
}

const topLabel = Math.max(1, Math.round(dataPeak / 3600)) + 'h'
const botLabel = '0h'
const yw = Math.max(topLabel.length, botLabel.length)
const xrow = Array.from({ length: width }, () => ' ')
const start = last14.start.slice(5)
const end = last14.end.slice(5)
for (let i = 0; i < start.length && i < width; i++) xrow[i] = start[i]
const endAt = Math.max(0, width - end.length)
for (let i = 0; i < end.length && endAt + i < width; i++) xrow[endAt + i] = end[i]

const trend =
  days.length > 0
    ? [
        ...graph.map((g, r) => (r === 0 ? topLabel : '').padStart(yw) + ' ' + (r === 0 ? '┤' : '│') + g),
        botLabel.padStart(yw) + ' ' + '└' + '─'.repeat(width),
        ' '.repeat(yw + 2) + xrow.join(''),
      ].join('\n')
    : 'no data'

<!--CUSTOM_WAKA_END-->

```
{trend}
```

## Languages ({last14.label})

<!--CUSTOM_WAKA_START-->

const nbsp = '\u00a0'
const ranked = (arr, n) => {
  if (!arr || arr.length === 0) return '- no data yet'
  return arr
    .slice(0, n)
    .map((x) => '- ' + x.name.padEnd(20, nbsp) + nbsp + fmt(x.time))
    .join('\n')
}
const languages14 = ranked(last14.languages, 5)
const editors14 = ranked(last14.editors, 5)

<!--CUSTOM_WAKA_END-->

{languages14}

## Editors ({last14.label})

{editors14}

Last updated at {updatedAt} (UTC)
