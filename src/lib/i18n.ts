import i18n from "i18next";
import { initReactI18next } from "react-i18next";

/** 支持的语言 */
export type Locale = "zh" | "en";

/** 语言显示名 */
export const LOCALE_LABELS: Record<Locale, string> = {
  zh: "中文",
  en: "English",
};

const STORAGE_KEY = "locale";

/**
 * 将任意语言代码收敛为受支持的 Locale，未识别时回退 zh。
 * 避免直接把 i18n.language 断言为 Locale 后索引多语言数据失败。
 */
export function normalizeLocale(lng: string | null | undefined): Locale {
  return lng && lng in LOCALE_LABELS ? (lng as Locale) : "zh";
}

function readStoredLocale(): Locale {
  try {
    return normalizeLocale(localStorage.getItem(STORAGE_KEY));
  } catch {
    // localStorage 不可用时忽略
  }
  return "zh";
}

i18n.use(initReactI18next).init({
  resources: {
    zh: {
      translation: {
        "header.title": "All the Mons 宝点心概率计算",
        "intro.description":
          "计算 <atm/> 整合包中，不同树果 / 材料搭配制作的宝点心在指定场景下对宝可梦刷新的影响。计算逻辑复刻自 <cobblemon/> 模组。",
        "intro.version": "（对应版本 All the Mons {{atm}} / Cobblemon {{cobblemon}}）",
        "intro.snapshot":
          "数据快照生成于 {{time}}{{version}}，已合并 All the Mons 的 材料与生成池覆盖（如 ATM苹果、ATM胡萝卜及神兽/幻兽生成条目）。共 {{species}} 种宝可梦、{{pool}} 条生成池条目、{{materials}} 种材料。",

        "material.title": "材料选择",
        "material.description":
          "制作宝点心使用的树果 / 材料，共 {{max}} 个槽位，可重复选择；仅列出影响刷新概率 / 频率的材料，纯个体加成（性格、个体值等）材料不显示。",
        "material.placeholder": "搜索材料名称…",
        "material.clear": "清空（{{count}}/{{max}}）",
        "material.emptySlot": "空槽位 {{index}}",
        "material.remove": "移除 {{name}}",
        "material.hint":
          "点击材料会加入下一个空槽位，重复点击可重复添加；点击已选槽位即可移除。",

        "biome.placeholder": "搜索群系 id 或 #标签…（如 plains / #is_forest）",
        "biome.empty": "无匹配群系",
        "biome.count": "共 {{count}} 个可解析群系。",

        "scenario.title": "场景设置",
        "scenario.description": "选择所在群系，可通过名字或 #标签 筛选。",
        "scenario.biome": "群系",
        "scenario.tags": "解析出 {{count}} 个群系标签：",
        "scenario.tagsEmpty": "该群系无法解析出刷新相关标签，结果将为空。",
        "scenario.timeOfDay": "时段",
        "timeOfDay.day": "白天",
        "timeOfDay.dusk": "黄昏",
        "timeOfDay.night": "夜晚",
        "scenario.dimension": "维度",
        "dimension.minecraft:overworld": "主世界",
        "dimension.minecraft:the_nether": "下界",
        "dimension.minecraft:the_end": "末地",
        "scenario.weather": "天气",
        "scenario.position": "生成位置",
        "scenario.sky": "天空可见",
        "sky.open": "露天",
        "sky.sheltered": "不露天",
        "scenario.height": "高度",
        "scenario.heightHint":
          "「低处」对应 Y −64~63（海平面及以下，含地下）；「高处」对应 Y 64~320（山顶 / 高空）。",
        "height.low": "低处",
        "height.high": "高处",
        "height.any": "不限",
        "scenario.skyExposure": "天空光照",
        "skyExposure.open": "露天（15）",
        "skyExposure.semi": "半遮蔽（1~14）",
        "skyExposure.closed": "封闭（0）",
        "scenario.localLight": "环境亮度",
        "localLight.bright": "明亮（8~15）",
        "localLight.dim": "昏暗（1~7）",
        "localLight.dark": "无光（0）",
        "scenario.moonPhase": "月相",
        "moonPhase.full": "满月（0）",
        "moonPhase.waning": "渐亏（1~3）",
        "moonPhase.new": "新月（4）",
        "moonPhase.waxing": "渐盈（5~7）",
        "moonPhase.any": "不限",
        "scenario.slimeChunk": "史莱姆区块",
        "slimeChunk.yes": "是",
        "slimeChunk.no": "否",
        "scenario.structure": "所在结构",
        "structure.none": "无",
        "structure.placeholder": "搜索结构…",
        "structure.empty": "无匹配结构",
        "scenario.features": "附近特殊方块",
        "scenario.featuresHint":
          "勾选当前环境附近存在的特殊方块；未勾选即视为普通自然地形。",
        "scenario.baseFeatures": "地面方块",
        "blockFeature.natural": "自然",
        "blockFeature.tooltip": "包含方块：",
        "blockFeature.flowers": "花朵",
        "blockFeature.redstone": "红石",
        "blockFeature.lightning_rod": "避雷针",
        "blockFeature.amethyst": "紫水晶",
        "blockFeature.wool": "羊毛/地毯",
        "blockFeature.machines": "机械",
        "blockFeature.lava": "岩浆",
        "blockFeature.water": "水/珊瑚",
        "blockFeature.ores": "矿石",
        "blockFeature.sand": "沙",
        "blockFeature.concrete": "混凝土",
        "blockFeature.cake": "蛋糕",
        "blockFeature.sugar_cane": "甘蔗",
        "blockFeature.saccharine_trees": "糖果树",
        "blockFeature.pumpkin": "南瓜",
        "blockFeature.wheat": "小麦",
        "blockFeature.berries": "树果/浆果",
        "blockFeature.trees": "树木/树叶",
        "blockFeature.structures": "建筑方块",
        "blockFeature.furnishings": "陈设",
        "blockFeature.farmland": "农田",

        "lure.title": "吸引效果摘要",
        "lure.empty": "尚未选择材料。",
        "lure.description":
          "合并后的效果。属性 / 蛋群吸引会提高对应宝可梦的权重，基础点数筛选只保留匹配的宝可梦。",
        "lure.trigger": "（触发 {{chance}}%）",
        "lure.typingHint": "仅第一个属性效果生效，其余属性吸引不参与权重计算。",
        "lure.evNote": "只保留对应能力有基础点数的宝可梦，其余权重归 0。",

        "table.name": "宝可梦",
        "table.type": "属性",
        "table.rarity": "稀有度",
        "table.baseProb": "基础概率",
        "table.afterProb": "吸引后概率",
        "table.change": "变化",
        "table.baitMatch": "命中吸引",
        "table.bucketSeparator": "、",
        "table.summary":
          "场景内共 {{total}} 种宝可梦{{note}}。上升 {{up}}，下降 {{down}}，其中 {{blocked}} 被基础点数过滤。",
        "table.summaryBaseNote": "（未选择材料，以下为基础刷新概率）",
        "table.filterPlaceholder": "按名字筛选…",
        "table.empty": "无匹配条目",
        "table.emptyHint": "该场景下没有符合条件的出生条目，请调整场景设置。",
        "table.evFiltered": "基础点数过滤",

        "page.loadFailed": "数据加载失败",
        "page.retry": "重试",
        "page.loading": "正在加载数据…",

        "algo.title": "算法说明",
        "algo.model":
          "概率模型：先按宝点心桶权重（common 83.25 / uncommon 11.25 / rare 4.125 / ultra-rare 1.375）加权选桶，再在桶内按条目权重加权选择，最后按宝可梦汇总。若材料含 rarity_bucket 效果，桶权重会先取 w^(1/n) 并归一到 100，使稀有度桶被拉平、高稀有宝可梦相对更容易出现。",
        "algo.slots":
          "材料最多 {{max}} 个槽位（对应游戏中烹饪锅的调料槽），可重复放置，相同材料效果会叠加合并；槽位顺序影响「首个」属性 / 基础点数效果。",
        "algo.source":
          "属性吸引与基础点数筛选只取「第一个」对应效果（与材料选择顺序有关）；蛋组吸引遍历全部蛋组效果。各材料自带的 weightMultiplier（时间/天气修正）与 drops 在本工具中未纳入。",
        "algo.data":
          "数据合并自 Cobblemon 源码与 All the Mons 数据包覆盖（材料与生成池）；结果反映的是相对刷新概率变化，未模拟实际的生成频率（每区块数量、生成周期等）。",
        "algo.aiNote": "注：英文版内容除模组自带文本外均由 AI 翻译。",

        "rarity.common": "普通",
        "rarity.uncommon": "少见",
        "rarity.rare": "稀有",
        "rarity.ultra-rare": "超稀有",
        "rarity.boss": "首领",

        "materialCategory.typing": "属性",
        "materialCategory.egg_group": "蛋群",
        "materialCategory.ev": "基础点数",
        "materialCategory.other": "其他",
        "materialCategory.count": "（{{count}}）",

        "effect.cobblemon:typing": "属性吸引",
        "effect.cobblemon:egg_group": "蛋群吸引",
        "effect.cobblemon:ev": "基础点数",
        "effect.cobblemon:rarity_bucket": "稀有度等级提升",
        "effect.cobblemon:bite_time": "上钩时间",
        "effect.cobblemon:nature": "性格",
        "effect.cobblemon:iv": "个体值",
        "effect.cobblemon:shiny_reroll": "发光概率",
        "effect.cobblemon:mark_chance": "证章",
        "effect.cobblemon:drops_reroll": "额外掉落",
        "effect.cobblemon:gender_chance": "性别",
        "effect.cobblemon:level_raise": "等级提升",
        "effect.cobblemon:ha_chance": "隐藏特性",
        "effect.cobblemon:alpha_chance": "头目概率",
        "effect.cobblemon:friendship": "亲密度",
        "effect.cobblemon:size": "体型",

        "position.grounded": "地面",
        "position.surface": "水面",
        "position.submerged": "水下",
        "position.seafloor": "海底",

        "weather.clear": "晴",
        "weather.rain": "雨",
        "weather.thunder": "雷暴",
      },
    },
    en: {
      translation: {
        "header.title": "All the Mons Poké Snack Calculator",

        "intro.description":
          "Calculate how Poké Snacks made from different berry / material combinations in the <atm/> modpack affect Pokémon spawns in a given scenario. The calculation logic is replicated from the <cobblemon/> mod.",
        "intro.version": "(for All the Mons {{atm}} / Cobblemon {{cobblemon}})",
        "intro.snapshot":
          "Data snapshot generated on {{time}} {{version}}, merged with All the Mons material and spawn pool overrides (e.g. ATM Apple, ATM Carrot and legendary/mythical spawn entries). {{species}} Pokémon, {{pool}} spawn pool entries, {{materials}} materials in total.",

        "material.title": "Material Selection",
        "material.description":
          "Berries / materials used to cook a Poké Snack: {{max}} slots, repeatable. Only materials that affect spawn rate / frequency are listed; individual-quality-only materials (nature, IV, etc.) are hidden.",
        "material.placeholder": "Search materials…",
        "material.clear": "Clear ({{count}}/{{max}})",
        "material.emptySlot": "Empty slot {{index}}",
        "material.remove": "Remove {{name}}",
        "material.hint":
          "Click a material to add it to the next empty slot; click repeatedly to add more. Click a selected slot to remove it.",

        "biome.placeholder": "Search biome id or #tag… (e.g. plains / #is_forest)",
        "biome.empty": "No matching biomes",
        "biome.count": "{{count}} resolvable biomes in total.",

        "scenario.title": "Scenario Settings",
        "scenario.description": "Select your biome. Filter by name or #tag.",
        "scenario.biome": "Biome",
        "scenario.tags": "{{count}} biome tags resolved:",
        "scenario.tagsEmpty":
          "No spawn-related tags can be resolved for this biome; the result will be empty.",
        "scenario.timeOfDay": "Time of Day",
        "timeOfDay.day": "Day",
        "timeOfDay.dusk": "Dusk",
        "timeOfDay.night": "Night",
        "scenario.dimension": "Dimension",
        "dimension.minecraft:overworld": "Overworld",
        "dimension.minecraft:the_nether": "Nether",
        "dimension.minecraft:the_end": "The End",
        "scenario.weather": "Weather",
        "scenario.position": "Spawn Position",
        "scenario.sky": "Sky Visibility",
        "sky.open": "Open sky",
        "sky.sheltered": "Enclosed",
        "scenario.height": "Elevation",
        "scenario.heightHint":
          '"Low" covers Y −64 to 63 (at/below sea level, incl. underground); "High" covers Y 64 to 320 (peaks / sky).',
        "height.low": "Low",
        "height.high": "High",
        "height.any": "Any",
        "scenario.skyExposure": "Sky Light",
        "skyExposure.open": "Open sky (15)",
        "skyExposure.semi": "Partially exposed (1~14)",
        "skyExposure.closed": "Enclosed (0)",
        "scenario.localLight": "Environmental Brightness",
        "localLight.bright": "Bright (8~15)",
        "localLight.dim": "Dim (1~7)",
        "localLight.dark": "Dark (0)",
        "scenario.moonPhase": "Moon Phase",
        "moonPhase.full": "Full (0)",
        "moonPhase.waning": "Waning (1~3)",
        "moonPhase.new": "New (4)",
        "moonPhase.waxing": "Waxing (5~7)",
        "moonPhase.any": "Any",
        "scenario.slimeChunk": "Slime Chunk",
        "slimeChunk.yes": "Yes",
        "slimeChunk.no": "No",
        "scenario.structure": "Structure",
        "structure.none": "None",
        "structure.placeholder": "Search structures…",
        "structure.empty": "No matching structure",
        "scenario.features": "Nearby Special Blocks",
        "scenario.featuresHint":
          "Tick the special blocks present nearby; unticked means ordinary natural terrain.",
        "scenario.baseFeatures": "Ground Block",
        "blockFeature.natural": "Natural",
        "blockFeature.tooltip": "Blocks:",
        "blockFeature.flowers": "Flowers",
        "blockFeature.redstone": "Redstone",
        "blockFeature.lightning_rod": "Lightning Rod",
        "blockFeature.amethyst": "Amethyst",
        "blockFeature.wool": "Wool / Carpet",
        "blockFeature.machines": "Machines",
        "blockFeature.lava": "Lava",
        "blockFeature.water": "Water / Coral",
        "blockFeature.ores": "Ores",
        "blockFeature.sand": "Sand",
        "blockFeature.concrete": "Concrete",
        "blockFeature.cake": "Cake",
        "blockFeature.sugar_cane": "Sugar Cane",
        "blockFeature.saccharine_trees": "Saccharine Trees",
        "blockFeature.pumpkin": "Pumpkin",
        "blockFeature.wheat": "Wheat",
        "blockFeature.berries": "Apricorns / Berries",
        "blockFeature.trees": "Trees / Leaves",
        "blockFeature.structures": "Structure Blocks",
        "blockFeature.furnishings": "Furnishings",
        "blockFeature.farmland": "Farmland",

        "lure.title": "Poké Snack Effect Summary",
        "lure.empty": "No materials selected yet.",
        "lure.description":
          "Combined effects. Type / Egg Group attraction boosts the spawn weight of matching Pokémon; EV filtering keeps only matching Pokémon.",
        "lure.trigger": "(triggers {{chance}}% of the time)",
        "lure.typingHint":
          "Only the first type effect applies; other type attractions do not affect spawn weights.",
        "lure.evNote":
          "Only Pokémon that yield EVs in the matching stat are kept; others get zero weight.",

        "table.name": "Pokémon",
        "table.type": "Type",
        "table.rarity": "Rarity",
        "table.baseProb": "Base Prob.",
        "table.afterProb": "After Snack",
        "table.change": "Change",
        "table.baitMatch": "Snack Match",
        "table.bucketSeparator": ", ",
        "table.summary":
          "{{total}} Pokémon in this scenario{{note}}. {{up}} boosted, {{down}} reduced, {{blocked}} filtered by EV.",
        "table.summaryBaseNote": " (no materials selected — base spawn rates shown)",
        "table.filterPlaceholder": "Filter by name…",
        "table.empty": "No matching entries",
        "table.emptyHint":
          "No spawn entries match this scenario. Adjust the scenario settings.",
        "table.evFiltered": "EV Filtered",

        "page.loadFailed": "Failed to load data",
        "page.retry": "Retry",
        "page.loading": "Loading data…",

        "algo.title": "Algorithm Notes",
        "algo.model":
          "Probability model: a bucket is first selected by Poké Snack bucket weights (common 83.25 / uncommon 11.25 / rare 4.125 / ultra-rare 1.375), then an entry is chosen by weight within the bucket, and results are aggregated by species. With rarity_bucket effects, bucket weights are transformed with w^(1/n) and normalized to 100, flattening the rarity buckets so rarer Pokémon appear relatively more often.",
        "algo.slots":
          'Up to {{max}} material slots (matching the in-game cooking pot seasoning slots); duplicates merge additively, and slot order determines the "first" type / EV effect.',
        "algo.source":
          'Type attraction and EV filtering use only the "first" matching effect (material order matters); Egg Group attraction iterates all egg group effects. Each material\'s own weightMultiplier (time/weather modifiers) and drops are not included.',
        "algo.data":
          "Data is merged from Cobblemon source and All the Mons datapack overrides (materials and spawn pools). Results reflect relative spawn probability changes, not actual spawn frequency (per-chunk counts, spawn cycles, etc.).",
        "algo.aiNote":
          "Note: English content other than the text shipped with the mod is AI-translated.",

        "rarity.common": "Common",
        "rarity.uncommon": "Uncommon",
        "rarity.rare": "Rare",
        "rarity.ultra-rare": "Ultra Rare",
        "rarity.boss": "Boss",

        "materialCategory.typing": "Type",
        "materialCategory.egg_group": "Egg Group",
        "materialCategory.ev": "EV",
        "materialCategory.other": "Other",
        "materialCategory.count": " ({{count}})",

        "effect.cobblemon:typing": "Type Attraction",
        "effect.cobblemon:egg_group": "Egg Group Attraction",
        "effect.cobblemon:ev": "EVs",
        "effect.cobblemon:rarity_bucket": "Rarity Bucket Boost",
        "effect.cobblemon:bite_time": "Bite Time",
        "effect.cobblemon:nature": "Nature",
        "effect.cobblemon:iv": "IV Bonus",
        "effect.cobblemon:shiny_reroll": "Shiny Chance",
        "effect.cobblemon:mark_chance": "Mark Chance",
        "effect.cobblemon:drops_reroll": "Drops Reroll",
        "effect.cobblemon:gender_chance": "Gender",
        "effect.cobblemon:level_raise": "Level Boost",
        "effect.cobblemon:ha_chance": "Hidden Ability",
        "effect.cobblemon:alpha_chance": "Alpha Pokémon",
        "effect.cobblemon:friendship": "Friendship",
        "effect.cobblemon:size": "Size",

        "position.grounded": "Grounded",
        "position.surface": "Surface",
        "position.submerged": "Submerged",
        "position.seafloor": "Seafloor",

        "weather.clear": "Clear",
        "weather.rain": "Rain",
        "weather.thunder": "Thunder",
      },
    },
  },
  lng: readStoredLocale(),
  fallbackLng: "zh",
  // 禁用键分隔符：本字典为扁平键（如 header.title、effect.cobblemon:egg_group），
  // 默认的 nsSeparator ":" 会把效果键拆散导致查找失败
  nsSeparator: false,
  keySeparator: false,
  interpolation: {
    escapeValue: false,
  },
});

i18n.on("languageChanged", (lng) => {
  localStorage.setItem(STORAGE_KEY, lng);
});

export default i18n;
