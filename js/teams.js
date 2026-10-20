// NBA 30 隊預設資料：控制台「快速揀球隊」用。
// logo 係相對網站根目錄嘅路徑，圖片放喺 logos/ 資料夾（256×256 透明 PNG）。
// color 係 Overlay 球隊底色，已揀過同隊徽有足夠對比。

export const NBA_TEAMS = [
  // 東岸
  { short: "ATL", name: "亞特蘭大鷹", conf: "東", color: "#C8102E" },
  { short: "BOS", name: "波士頓塞爾特人", conf: "東", color: "#007A33" },
  { short: "BKN", name: "布魯克林籃網", conf: "東", color: "#000000" },
  { short: "CHA", name: "夏洛特黃蜂", conf: "東", color: "#1D1160" },
  { short: "CHI", name: "芝加哥公牛", conf: "東", color: "#CE1141" },
  { short: "CLE", name: "克里夫蘭騎士", conf: "東", color: "#860038" },
  { short: "DET", name: "底特律活塞", conf: "東", color: "#1D42BA" },
  { short: "IND", name: "印第安納溜馬", conf: "東", color: "#002D62" },
  { short: "MIA", name: "邁阿密熱火", conf: "東", color: "#000000" },
  { short: "MIL", name: "密爾瓦基公鹿", conf: "東", color: "#00471B" },
  { short: "NYK", name: "紐約尼克斯", conf: "東", color: "#006BB6" },
  { short: "ORL", name: "奧蘭多魔術", conf: "東", color: "#0077C0" },
  { short: "PHI", name: "費城76人", conf: "東", color: "#006BB6" },
  { short: "TOR", name: "多倫多速龍", conf: "東", color: "#CE1141" },
  { short: "WAS", name: "華盛頓巫師", conf: "東", color: "#002B5C" },
  // 西岸
  { short: "DAL", name: "達拉斯獨行俠", conf: "西", color: "#00538C" },
  { short: "DEN", name: "丹佛金塊", conf: "西", color: "#0E2240" },
  { short: "GSW", name: "金州勇士", conf: "西", color: "#1D428A" },
  { short: "HOU", name: "侯斯頓火箭", conf: "西", color: "#000000" },
  { short: "LAC", name: "洛杉磯快艇", conf: "西", color: "#C8102E" },
  { short: "LAL", name: "洛杉磯湖人", conf: "西", color: "#552583" },
  { short: "MEM", name: "曼菲斯灰熊", conf: "西", color: "#5D76A9" },
  { short: "MIN", name: "明尼蘇達木狼", conf: "西", color: "#0C2340" },
  { short: "NOP", name: "新奧爾良鵜鶘", conf: "西", color: "#0C2340" },
  { short: "OKC", name: "奧克拉荷馬雷霆", conf: "西", color: "#007AC1" },
  { short: "PHX", name: "鳳凰城太陽", conf: "西", color: "#1D1160" },
  { short: "POR", name: "波特蘭拓荒者", conf: "西", color: "#000000" },
  { short: "SAC", name: "沙加緬度帝王", conf: "西", color: "#5A2D81" },
  { short: "SAS", name: "聖安東尼奧馬刺", conf: "西", color: "#C4CED4" },
  { short: "UTA", name: "猶他爵士", conf: "西", color: "#FFFFFF" }
].map((team) => ({ ...team, logo: `logos/${team.short}.png` }));

export function findTeam(short) {
  return NBA_TEAMS.find((t) => t.short === short) || null;
}
