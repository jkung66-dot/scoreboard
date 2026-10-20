// NBA 30 隊預設資料：控制台「揀球隊」用。
// name 係 Overlay 顯示嘅短中文名；full 係選單顯示嘅全名。
// logo 係相對網站根目錄嘅路徑，圖片放喺 logos/ 資料夾（256×256 透明 PNG）。
// color 係 Overlay 球隊底色，已揀過同隊徽有足夠對比。

export const NBA_TEAMS = [
  // 東岸
  { short: "ATL", name: "鷹", full: "亞特蘭大鷹", conf: "東", color: "#C8102E" },
  { short: "BOS", name: "塞爾特人", full: "波士頓塞爾特人", conf: "東", color: "#007A33" },
  { short: "BKN", name: "籃網", full: "布魯克林籃網", conf: "東", color: "#000000" },
  { short: "CHA", name: "黃蜂", full: "夏洛特黃蜂", conf: "東", color: "#1D1160" },
  { short: "CHI", name: "公牛", full: "芝加哥公牛", conf: "東", color: "#CE1141" },
  { short: "CLE", name: "騎士", full: "克里夫蘭騎士", conf: "東", color: "#860038" },
  { short: "DET", name: "活塞", full: "底特律活塞", conf: "東", color: "#1D42BA" },
  { short: "IND", name: "溜馬", full: "印第安納溜馬", conf: "東", color: "#002D62" },
  { short: "MIA", name: "熱火", full: "邁阿密熱火", conf: "東", color: "#000000" },
  { short: "MIL", name: "公鹿", full: "密爾瓦基公鹿", conf: "東", color: "#00471B" },
  { short: "NYK", name: "尼克斯", full: "紐約尼克斯", conf: "東", color: "#006BB6" },
  { short: "ORL", name: "魔術", full: "奧蘭多魔術", conf: "東", color: "#0077C0" },
  { short: "PHI", name: "76人", full: "費城76人", conf: "東", color: "#006BB6" },
  { short: "TOR", name: "速龍", full: "多倫多速龍", conf: "東", color: "#CE1141" },
  { short: "WAS", name: "巫師", full: "華盛頓巫師", conf: "東", color: "#002B5C" },
  // 西岸
  { short: "DAL", name: "獨行俠", full: "達拉斯獨行俠", conf: "西", color: "#00538C" },
  { short: "DEN", name: "金塊", full: "丹佛金塊", conf: "西", color: "#0E2240" },
  { short: "GSW", name: "勇士", full: "金州勇士", conf: "西", color: "#1D428A" },
  { short: "HOU", name: "火箭", full: "侯斯頓火箭", conf: "西", color: "#000000" },
  { short: "LAC", name: "快艇", full: "洛杉磯快艇", conf: "西", color: "#C8102E" },
  { short: "LAL", name: "湖人", full: "洛杉磯湖人", conf: "西", color: "#552583" },
  { short: "MEM", name: "灰熊", full: "曼菲斯灰熊", conf: "西", color: "#5D76A9" },
  { short: "MIN", name: "木狼", full: "明尼蘇達木狼", conf: "西", color: "#0C2340" },
  { short: "NOP", name: "鵜鶘", full: "新奧爾良鵜鶘", conf: "西", color: "#0C2340" },
  { short: "OKC", name: "雷霆", full: "奧克拉荷馬雷霆", conf: "西", color: "#007AC1" },
  { short: "PHX", name: "太陽", full: "鳳凰城太陽", conf: "西", color: "#1D1160" },
  { short: "POR", name: "拓荒者", full: "波特蘭拓荒者", conf: "西", color: "#000000" },
  { short: "SAC", name: "帝王", full: "沙加緬度帝王", conf: "西", color: "#5A2D81" },
  { short: "SAS", name: "馬刺", full: "聖安東尼奧馬刺", conf: "西", color: "#C4CED4" },
  { short: "UTA", name: "爵士", full: "猶他爵士", conf: "西", color: "#FFFFFF" }
].map((team) => ({ ...team, logo: `logos/${team.short}.png` }));

export function findTeam(short) {
  return NBA_TEAMS.find((t) => t.short === short) || null;
}
