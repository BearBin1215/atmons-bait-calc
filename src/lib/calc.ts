/**
 * 宝点心吸引计算核心。
 *
 * 复刻 Cobblemon 源码中的机制：
 * - SpawnBaitUtils.mergeEffects：按 (type, subcategory) 合并，chance 求和（上限 1）、value 求和后向上取整
 * - SpawnBaitInfluence.affectWeight：typing / egg_group / ev 对权重的影响
 *   （注意：源码用「未合并」的原始效果列表取首个 typing / ev 效果，蛋组则遍历原始列表；本模块忠实复刻）
 * - BucketNormalizingInfluence：rarity_bucket 层级把各稀有度桶权重取 w^(1/n) 后归一到 100
 * - 概率模型：先按 pokeSnackBuckets 权重选桶，再在桶内按条目权重加权选择
 *
 * 各函数注释中的源码位置均相对于
 * ../cobblemon/cobblemon/common/src/main/kotlin/com/cobblemon/mod/common/，
 * 行号基于 Cobblemon 1.8.0 快照，随源码更新可能漂移。
 */
import type {
  BaitEffect,
  AllTheMonsData,
  MaterialInfo,
  PoolEntry,
  SpawnConditionSnapshot,
  SpeciesInfo,
  WeightMultiplier,
} from "./types";

/**
 * 宝点心生成池配置。
 * 源码位置：api/spawning/preset/BestSpawnerConfig.kt:64（pokeSnackBuckets 默认值），
 * 由 api/spawning/spawner/PokeSnackSpawnerFactory.kt:75 传入 spawner 的 buckets。
 */
export const POKE_SNACK_BUCKETS: Record<string, number> = {
  common: 83.25,
  uncommon: 11.25,
  rare: 4.125,
  "ultra-rare": 1.375,
};

/**
 * 稀有度桶归一化参数。
 * 源码位置：api/spawning/spawner/PokeSnackSpawnerFactory.kt:58-62
 * （BucketNormalizingInfluence(tier, gradient = 0.2F, firstTier = 1.2F)）。
 */
const BUCKET_FIRST_TIER = 1.2;
const BUCKET_GRADIENT = 0.2;

/** 效果类型常量（对应 SpawnBait.Effects） */
const EFFECT = {
  TYPING: "cobblemon:typing",
  EGG_GROUP: "cobblemon:egg_group",
  EV: "cobblemon:ev",
  RARITY_BUCKET: "cobblemon:rarity_bucket",
  BITE_TIME: "cobblemon:bite_time",
} as const;

/** 不参与权重、只影响生成个体质量的效果类型 */
const QUALITY_EFFECT_TYPES = new Set([
  "cobblemon:nature",
  "cobblemon:iv",
  "cobblemon:shiny_reroll",
  "cobblemon:mark_chance",
  "cobblemon:drops_reroll",
  "cobblemon:gender_chance",
  "cobblemon:level_raise",
  "cobblemon:ha_chance",
  "cobblemon:alpha_chance",
  "cobblemon:friendship",
  "cobblemon:size",
]);

/**
 * 合并效果（复刻 SpawnBaitUtils.mergeEffects）。
 * 按 (type, subcategory) 分组：chance 求和但不超过 1，value 求和后向上取整。
 * 源码位置：api/fishing/SpawnBaitUtils.kt:15-29
 */
export function mergeEffects(effects: BaitEffect[]): BaitEffect[] {
  const groups = new Map<string, BaitEffect[]>();
  for (const effect of effects) {
    const key = `${effect.type}\u0000${effect.subcategory ?? ""}`;
    const list = groups.get(key) ?? [];
    list.push(effect);
    groups.set(key, list);
  }

  return [...groups.values()].map((group) => {
    const { type, subcategory } = group[0]!;
    const totalChance = group.reduce((sum, e) => sum + e.chance, 0);
    const totalValue = group.reduce((sum, e) => sum + e.value, 0);
    return {
      type,
      subcategory,
      chance: Math.min(totalChance, 1),
      value: Math.ceil(totalValue),
    };
  });
}

/**
 * 解析某个材料的效果列表。
 * @param material 材料
 * @param data 聚合数据
 * @returns 该材料对应的原始效果列表（可能为空）
 */
function getMaterialEffects(material: MaterialInfo, data: AllTheMonsData): BaitEffect[] {
  return data.baitEffects[material.baitId]?.effects ?? [];
}

/** 时段：按 Cobblemon 内置 TimeRange 与条目时段求交集 */
export type TimeOfDay = "day" | "dusk" | "night";

/** 标准 Minecraft 维度 id；天空光层是否存在由维度类型决定 */
export type DimensionId = "minecraft:overworld" | "minecraft:the_nether" | "minecraft:the_end";

/** 场景天气 */
export type Weather = "clear" | "rain" | "thunder";

/** 天空可见性：决定 canSeeSky 假设（露天 / 不露天） */
export type SkyVisibility = "open" | "sheltered";

/** 高度范围：决定 Y 区间假设（低处 / 高处 / 不限） */
export type HeightRange = "low" | "high" | "any";

/**
 * 天空暴露度：决定静态天空光照（LightLayer.SKY，与昼夜无关）区间假设。
 * 天空光照反映位置能接收到多少天空光：露天恒 15，随深度/遮挡 flood-fill 衰减。
 */
export type SkyExposure = "open" | "semi" | "closed";

/** 环境亮度：对应 Cobblemon SpawnablePosition.light */
export type LocalLightRange = "bright" | "dim" | "dark";

/** 月相：当前月相假设（满月 / 渐亏 / 新月 / 渐盈 / 不限） */
export type MoonPhase = "full" | "waning" | "new" | "waxing" | "any";

/** 是否在史莱姆区块 */
export type SlimeChunk = "yes" | "no";

/** 各天空可见性假定的 canSeeSky 值 */
const SKY_VISIBILITIES: Record<SkyVisibility, { seesSky: boolean }> = {
  open: { seesSky: true },
  sheltered: { seesSky: false },
};

/** 各高度范围假定的 Y 区间（Y 用区间重叠判定，null=不限制） */
const HEIGHT_RANGES: Record<HeightRange, { minY: number | null; maxY: number | null }> = {
  // 低处覆盖地下至海平面（主世界常见生成）；高处覆盖海平面以上（山顶 / 高空）
  low: { minY: -64, maxY: 63 },
  high: { minY: 64, maxY: 320 },
  any: { minY: null, maxY: null },
};

/** 各天空暴露度假定的天空光照区间（有天空光维度，0~15） */
const SKY_EXPOSURES: Record<SkyExposure, { minSkyLight: number; maxSkyLight: number }> = {
  // 露天恒 15；其余位置按 flood-fill 衰减；无天空光为 0
  open: { minSkyLight: 15, maxSkyLight: 15 },
  semi: { minSkyLight: 1, maxSkyLight: 14 },
  closed: { minSkyLight: 0, maxSkyLight: 0 },
};

/** 各环境亮度范围假定的区间（0~15，与条目区间用重叠判定） */
const LOCAL_LIGHT_RANGES: Record<LocalLightRange, { minLight: number; maxLight: number }> = {
  bright: { minLight: 8, maxLight: 15 },
  dim: { minLight: 1, maxLight: 7 },
  dark: { minLight: 0, maxLight: 0 },
};

/** Vanilla DimensionType.hasSkylight：主世界为 true，下界和末地为 false。 */
const DIMENSIONS_WITH_SKY_LIGHT = new Set<DimensionId>(["minecraft:overworld"]);

/** Cobblemon 1.8.0 TimeRange.kt 的内置 tick 区间。 */
const COBBLEMON_TIME_RANGES: Record<string, readonly (readonly [number, number])[]> = {
  any: [[0, 23999]],
  day: [
    [23460, 23999],
    [0, 12541],
  ],
  night: [[12542, 23459]],
  morning: [
    [23000, 23999],
    [0, 4999],
  ],
  noon: [[5000, 6999]],
  afternoon: [[7000, 12999]],
  evening: [[13000, 16999]],
  midnight: [[17000, 18999]],
  predawn: [[19000, 22999]],
  dawn: [
    [22300, 23999],
    [0, 166],
  ],
  dusk: [[11834, 13701]],
  twilight: [
    [11834, 13701],
    [22300, 23999],
    [0, 166],
  ],
};

/** 界面时段直接复用对应的 Cobblemon 内置区间。 */
const SCENARIO_TIME_RANGES: Record<TimeOfDay, readonly (readonly [number, number])[]> = {
  day: COBBLEMON_TIME_RANGES.day,
  dusk: COBBLEMON_TIME_RANGES.dusk,
  night: COBBLEMON_TIME_RANGES.night,
};

/**
 * 各月相分组对应的月相编号（Minecraft：0 满月 → 1-3 渐亏 → 4 新月 → 5-7 渐盈）。
 * 条目 moonPhases 与所选分组的编号集合有交集即通过。
 */
const MOON_PHASE_GROUPS: Record<MoonPhase, readonly number[]> = {
  full: [0],
  waning: [1, 2, 3],
  new: [4],
  waxing: [5, 6, 7],
  any: [0, 1, 2, 3, 4, 5, 6, 7],
};

/** 计算场景（选择生物群系 + 光照 + 天气 + 生成位置 + 环境/结构） */
export interface Scenario {
  /**
   * 生物群系标签列表，如 ["#cobblemon:is_jungle", "#cobblemon:is_overworld"]。
   * 表示当前群系同时属于这些标签：出生条目条件命中任一标签即纳入，
   * 反向条件命中任一标签即排除（取并集）。
   */
  biomeTags: readonly string[];
  /** 时段：按 Cobblemon 内置 tick 区间与条目 timeRange 求交集 */
  timeOfDay: TimeOfDay;
  /** 标准维度 id；决定是否存在天空光层，也用于 dimensions 条件 */
  dimension: DimensionId;
  /** 天气：clear 晴 / rain 雨 / thunder 雷暴 */
  weather: Weather;
  /** 包含的生成位置类型 */
  posTypes: readonly string[];
  /**
   * 附近存在的特殊方块特征 id 列表（用户声明，如 redstone / amethyst）。
   * 条目 requiredNearby 列表内任一命中。
   */
  features: readonly string[];
  /**
   * 脚下基底方块特征 id 列表（用户声明）。
   * 条目 requiredBase 列表内任一命中；natural 基底由界面默认传入。
   */
  baseFeatures: readonly string[];
  /**
   * 天空可见性（露天 / 不露天）：决定 canSeeSky 假设。
   * 选中结构时，结构匹配条目的 canSeeSky 由结构内部决定，不受环境假设限制。
   */
  sky: SkyVisibility;
  /** 高度范围（低处 / 高处 / 不限）：决定 Y 区间假设 */
  height: HeightRange;
  /** 天空暴露度（露天 / 半遮蔽 / 封闭）：决定静态天空光照区间假设 */
  skyExposure: SkyExposure;
  /** 环境亮度（明亮 / 昏暗 / 无）：对应 SpawnablePosition.light */
  localLight: LocalLightRange;
  /** 月相（满月 / 渐亏 / 新月 / 渐盈 / 不限）：决定月相编号集合假设 */
  moonPhase: MoonPhase;
  /** 是否在史莱姆区块（是 / 否） */
  slimeChunk: SlimeChunk;
  /** 所在结构 id/tag（null=普通地形，不在结构中） */
  structure: string | null;
}

/** 天气是否为「下雨」（雨或雷暴） */
function isRaining(weather: Weather): boolean {
  return weather === "rain" || weather === "thunder";
}

/** 合并后的吸引效果摘要 */
export interface LureSummary {
  /** 原始效果列表（按材料选择顺序） */
  raw: BaitEffect[];
  /** 合并后效果 */
  merged: BaitEffect[];
  /** rarity_bucket 合并后的总层级（决定桶归一化强度） */
  rarityTier: number;
  /** typing 相关效果（合并后） */
  typingEffects: BaitEffect[];
  /** egg_group 相关效果（合并后） */
  eggGroupEffects: BaitEffect[];
  /** ev 相关效果（合并后） */
  evEffects: BaitEffect[];
  /** bite_time 相关效果（合并后） */
  biteTimeEffects: BaitEffect[];
  /** 影响生成个体质量的效果（合并后） */
  qualityEffects: BaitEffect[];
  /** 权重计算实际生效的首个 typing 效果（源码取原始列表首个） */
  activeTypingEffect: BaitEffect | null;
  /** 权重计算实际生效的首个 ev 效果 */
  activeEvEffect: BaitEffect | null;
}

/**
 * 由选中的材料 id 列表解析出完整吸引效果摘要。
 * 源码位置：api/spawning/spawner/PokeSnackSpawnerFactory.kt:51-67（influenceBuilders）--
 * 稀有度层级 = 原始 rarity_bucket 效果 value 求和取整（53-56 行），
 * SpawnBaitInfluence 直接使用原始效果列表（64-66 行）。
 * @param materialIds 材料 id 列表（顺序即材料顺序，影响首 typing/ev 效果）
 * @param data 聚合数据
 */
export function resolveLure(materialIds: string[], data: AllTheMonsData): LureSummary {
  const byId = new Map(data.materials.map((m) => [m.id, m]));
  const raw: BaitEffect[] = [];
  for (const id of materialIds) {
    const material = byId.get(id);
    if (!material) {
      continue;
    }
    raw.push(...getMaterialEffects(material, data));
  }
  const merged = mergeEffects(raw);
  /** 按效果类型过滤合并后的效果 */
  const byType = (type: string) => merged.filter((e) => e.type === type);

  const activeTypingEffect = raw.find((e) => e.type === EFFECT.TYPING) ?? null;
  const activeEvEffect = raw.find((e) => e.type === EFFECT.EV) ?? null;

  return {
    raw,
    merged,
    // 与源码 PokeSnackSpawnerFactory 一致：稀有度层级 = 原始 rarity_bucket 效果 value 之和取整
    rarityTier: Math.floor(
      raw.filter((e) => e.type === EFFECT.RARITY_BUCKET).reduce((s, e) => s + e.value, 0),
    ),
    typingEffects: byType(EFFECT.TYPING),
    eggGroupEffects: byType(EFFECT.EGG_GROUP),
    evEffects: byType(EFFECT.EV),
    biteTimeEffects: byType(EFFECT.BITE_TIME),
    qualityEffects: merged.filter((e) => QUALITY_EFFECT_TYPES.has(e.type)),
    activeTypingEffect,
    activeEvEffect,
  };
}

/** 单物种的权重影响结果 */
export interface SpeciesWeightResult {
  /** 最终权重（0 = 被 ev 条件过滤掉） */
  weight: number;
  /** 命中的属性（首个 typing 效果对应的属性，若命中） */
  matchedTyping: string | null;
  /** 命中的蛋群 */
  matchedEggGroups: string[];
  /** 因 EV 产量不匹配被过滤的属性（null = 未被过滤） */
  blockedByEv: string | null;
}

/**
 * EV 效果子类别（Showdown 短代码）到物种 evYield 键的映射。
 * 对应 Cobblemon 源码 Stats.getStat()：
 * 源码位置：api/pokemon/stats/Stats.kt:53-62
 * hp->hp, atk/attack->attack, def/defense/defence->defence,
 * spa->special_attack, spd->special_defence, spe/speed->speed。
 * Cobblemon 使用英式拼写 defence（非 defense），evYield 键与此一致。
 */
export const EV_STAT_KEYS: Record<string, string> = {
  hp: "hp",
  atk: "attack",
  attack: "attack",
  def: "defence",
  defense: "defence",
  defence: "defence",
  spa: "special_attack",
  spd: "special_defence",
  spe: "speed",
  speed: "speed",
};

/**
 * 计算单个物种受吸引效果的权重影响（复刻 SpawnBaitInfluence.affectWeight）。
 * 源码位置：api/spawning/influence/SpawnBaitInfluence.kt:63-141 --
 * EV 取原始列表首个效果、产量不匹配时权重归 0（88-102 行），
 * typing 取原始列表首个效果、命中属性乘 value（104-117 行），
 * egg_group 遍历原始列表、首个命中蛋组乘 value（119-137 行）。
 * 各效果类型均直接在原始列表上查找（merged 由 raw 合并而来，
 * raw 中不存在对应类型时查找自然落空，无需再经 merged 预判）。
 * @param species 物种信息（未知返回 null 乘数）
 * @param raw 原始（未合并）效果列表
 */
export function computeSpeciesWeight(
  species: SpeciesInfo | null,
  raw: BaitEffect[],
): SpeciesWeightResult {
  if (!species) {
    return {
      weight: 1,
      matchedTyping: null,
      matchedEggGroups: [],
      blockedByEv: null,
    };
  }

  let weight = 1;
  let blockedByEv: string | null = null;

  // EV：源码取原始列表首个 ev 效果；物种对应能力产量为 0 时权重归 0
  const evEffect = raw.find((e) => e.type === EFFECT.EV);
  if (evEffect?.subcategory) {
    const stat = evEffect.subcategory;
    const evYieldValue = species.evYield[EV_STAT_KEYS[stat] ?? stat] ?? 0;
    if (evYieldValue <= 0) {
      weight = 0;
      blockedByEv = stat;
    }
  }

  let matchedTyping: string | null = null;
  // typing：源码取原始列表首个 typing 效果，命中属性则乘以 value
  if (weight > 0) {
    const typingEffect = raw.find((e) => e.type === EFFECT.TYPING);
    if (typingEffect?.subcategory && species.types.includes(typingEffect.subcategory)) {
      matchedTyping = typingEffect.subcategory;
      weight *= typingEffect.value;
    }
  }

  // egg_group：遍历原始列表，命中任一蛋组则乘以对应 value
  const matchedEggGroups: string[] = [];
  if (weight > 0) {
    for (const effect of raw) {
      if (effect.type !== EFFECT.EGG_GROUP || !effect.subcategory) {
        continue;
      }
      if (species.eggGroups.includes(effect.subcategory)) {
        matchedEggGroups.push(effect.subcategory);
        weight *= effect.value;
        break;
      }
    }
  }

  return {
    weight,
    matchedTyping,
    matchedEggGroups,
    blockedByEv,
  };
}

/** 判断两个闭区间是否有交集。场景选项表示一组可能位置，因此使用存在性判断。 */
function rangesOverlap(aMin: number, aMax: number, bMin: number, bMax: number): boolean {
  return aMin <= bMax && aMax >= bMin;
}

/** 将一个条件对象的时间范围与场景时段做存在性匹配。 */
function timeRangeMatches(timeRange: string | null | undefined, timeOfDay: TimeOfDay): boolean {
  if (!timeRange || timeRange === "any") {
    return true;
  }
  const entryRanges = COBBLEMON_TIME_RANGES[timeRange];
  if (!entryRanges) {
    return false;
  }
  return entryRanges.some(([entryMin, entryMax]) =>
    SCENARIO_TIME_RANGES[timeOfDay].some(([scenarioMin, scenarioMax]) =>
      rangesOverlap(entryMin, entryMax, scenarioMin, scenarioMax),
    ),
  );
}

/** 由条目字段构造统一条件快照，供正条件与反条件使用同一套判定。 */
function entryCondition(entry: PoolEntry): SpawnConditionSnapshot {
  return {
    biomes: entry.biomes,
    minSkyLight: entry.minSkyLight,
    maxSkyLight: entry.maxSkyLight,
    minLocalLight: entry.minLocalLight,
    maxLocalLight: entry.maxLocalLight,
    timeRange: entry.timeRange,
    moonPhases: entry.moonPhases,
    slimeChunk: entry.slimeChunk,
    isRaining: entry.isRaining,
    isThundering: entry.isThundering,
    canSeeSky: entry.canSeeSky,
    minY: entry.minY,
    maxY: entry.maxY,
    structures: entry.structures,
    requiredNearby: entry.requiredNearby,
    requiredBase: entry.requiredBase,
    dimensions: entry.dimensions,
  };
}

/**
 * 判断一个完整条件是否满足场景。
 * 同一条件内的字段全部满足；列表字段按 Cobblemon 的任一命中语义判断。
 */
function conditionMatchesScenario(
  condition: SpawnConditionSnapshot,
  scenario: Scenario,
  tagSet: Set<string>,
  nearbySet: Set<string>,
  baseSet: Set<string>,
): boolean {
  if (condition.biomes.length > 0 && !condition.biomes.some((b) => tagSet.has(b))) {
    return false;
  }
  if (condition.dimensions.length > 0 && !condition.dimensions.includes(scenario.dimension)) {
    return false;
  }
  const skyRange = DIMENSIONS_WITH_SKY_LIGHT.has(scenario.dimension)
    ? SKY_EXPOSURES[scenario.skyExposure]
    : SKY_EXPOSURES.closed;
  if (
    !rangesOverlap(
      condition.minSkyLight ?? 0,
      condition.maxSkyLight ?? 15,
      skyRange.minSkyLight,
      skyRange.maxSkyLight,
    )
  ) {
    return false;
  }
  const localRange = LOCAL_LIGHT_RANGES[scenario.localLight];
  if (
    !rangesOverlap(
      condition.minLocalLight ?? 0,
      condition.maxLocalLight ?? 15,
      localRange.minLight,
      localRange.maxLight,
    )
  ) {
    return false;
  }
  if (!timeRangeMatches(condition.timeRange, scenario.timeOfDay)) {
    return false;
  }
  if (
    condition.moonPhases &&
    scenario.moonPhase !== "any" &&
    !condition.moonPhases.some((p) => MOON_PHASE_GROUPS[scenario.moonPhase].includes(p))
  ) {
    return false;
  }
  if (condition.slimeChunk === true && scenario.slimeChunk === "no") {
    return false;
  }
  const raining = isRaining(scenario.weather);
  const thundering = scenario.weather === "thunder";
  if (condition.isRaining !== null && condition.isRaining !== raining) {
    return false;
  }
  if (condition.isThundering !== null && condition.isThundering !== thundering) {
    return false;
  }
  if (
    condition.canSeeSky !== null &&
    condition.canSeeSky !== SKY_VISIBILITIES[scenario.sky].seesSky
  ) {
    return false;
  }
  const height = HEIGHT_RANGES[scenario.height];
  if (
    height.minY !== null &&
    height.maxY !== null &&
    !rangesOverlap(condition.minY ?? -64, condition.maxY ?? 320, height.minY, height.maxY)
  ) {
    return false;
  }
  if (
    condition.structures.length > 0 &&
    (scenario.structure === null || !condition.structures.includes(scenario.structure))
  ) {
    return false;
  }
  if (
    condition.requiredNearby.length > 0 &&
    !condition.requiredNearby.some((feature) => nearbySet.has(feature))
  ) {
    return false;
  }
  if (
    condition.requiredBase.length > 0 &&
    !condition.requiredBase.some((feature) => baseSet.has(feature))
  ) {
    return false;
  }
  return true;
}

/**
 * 过滤出指定场景下的生成池条目（宝点心场景）。
 * 源码位置：api/spawning/condition/SpawningCondition.kt:77-135（fits）--
 * 天空光照区间（86-89 行）、环境（方块）光照区间（86 行）、昼夜时段 timeRange（90 行）、
 * 月相 moonPhase（84 行）、史莱姆区块 isSlimeChunk（116 行）、雨天 / 雷暴（94-97 行）、
 * biomes 条件任一命中（102-103 行，反条件见各子类的 anticondition 判断）。
 * 固定排除垂钓位置与仅垂钓（minLureLevel）条目--宝点心无法触发。
 * 群系匹配取并集：条目条件生物群系命中任一选中标签即纳入，
 * 反向条件对象内部字段全部满足时即命中，多个反条件对象任一命中即排除。
 * 天气匹配：按场景天气判断 isRaining / isThundering 条件。
 * 特殊方块匹配：requiredNearby / requiredBase 各列表内任一命中。
 * 结构匹配：未选结构排除仅结构条目，选中结构须命中；结构方块不自动视为附近方块。
 * 环境匹配：天空暴露度（静态天空光照 LightLayer.SKY，0~15 区间重叠）、
 * 环境亮度（总亮度，0~15 区间重叠）、canSeeSky 与 Y（区间重叠）、
 * 时段 timeRange（按 Cobblemon tick 区间求交）、月相（编号集合交集）、
 * 史莱姆区块按场景假设过滤。
 */
export function filterScenarioPool(data: AllTheMonsData, scenario: Scenario): PoolEntry[] {
  const posSet = new Set(scenario.posTypes);
  const tagSet = new Set(scenario.biomeTags);
  const nearbySet = new Set(scenario.features ?? []);
  const baseSet = new Set(scenario.baseFeatures ?? []);
  return data.spawnPool.filter((entry) => {
    if (entry.lureOnly) {
      return false;
    }
    if (!posSet.has(entry.pos)) {
      return false;
    }
    if (!conditionMatchesScenario(entryCondition(entry), scenario, tagSet, nearbySet, baseSet)) {
      return false;
    }
    if (
      entry.antiConditions.some((condition) =>
        conditionMatchesScenario(condition, scenario, tagSet, nearbySet, baseSet),
      )
    ) {
      return false;
    }
    return true;
  });
}

/**
 * 判断单个权重倍率的条件是否由场景满足（condition 全部满足且 anticondition 未命中）。
 * 源码位置：api/spawning/multiplier/WeightMultiplier.kt:33-37（affectWeight）--
 * conditions 为空或任一满足，且 anticonditions 为空或均不满足时乘以 multiplier；
 * 单个条件的判定复用 SpawningCondition.fits（同 filterScenarioPool 引用）。
 */
export function weightMultiplierApplies(wm: WeightMultiplier, scenario: Scenario): boolean {
  const cond = wm.condition;
  const anti = wm.anticondition;
  const raining = isRaining(scenario.weather);
  const thundering = scenario.weather === "thunder";

  const condOk =
    (cond.isRaining === undefined || cond.isRaining === raining) &&
    (cond.isThundering === undefined || cond.isThundering === thundering) &&
    timeRangeMatches(cond.timeRange, scenario.timeOfDay) &&
    (cond.biomes === undefined ||
      cond.biomes.length === 0 ||
      cond.biomes.some((b) => scenario.biomeTags.includes(b)));

  const hasAntiCondition =
    anti.isRaining !== undefined ||
    anti.isThundering !== undefined ||
    anti.timeRange !== undefined ||
    (anti.biomes !== undefined && anti.biomes.length > 0);
  const antiSatisfied =
    hasAntiCondition &&
    (anti.isRaining === undefined || anti.isRaining === raining) &&
    (anti.isThundering === undefined || anti.isThundering === thundering) &&
    timeRangeMatches(anti.timeRange, scenario.timeOfDay) &&
    (anti.biomes === undefined ||
      anti.biomes.length === 0 ||
      anti.biomes.some((b) => scenario.biomeTags.includes(b)));

  return condOk && !antiSatisfied;
}

/**
 * 计算条目在场景下的权重倍率乘积（多个倍率连乘）。
 * 源码位置：api/spawning/position/SpawnablePosition.kt:179 --
 * 生成位置计算权重时逐个应用 detail.weightMultipliers。
 */
export function weightMultiplierProduct(entry: PoolEntry, scenario: Scenario): number {
  let product = 1;
  for (const wm of entry.weightMultipliers ?? []) {
    if (weightMultiplierApplies(wm, scenario)) {
      product *= wm.multiplier;
    }
  }
  return product;
}

/** 单物种受影响后的汇总 */
export interface SpeciesImpact {
  /** 物种 id */
  id: string;
  /** 属性 */
  types: string[];
  /** 出现的稀有度桶 */
  buckets: string[];
  /** 生成位置类型 */
  posTypes: string[];
  /** 基础权重总和（各条目求和） */
  baseWeight: number;
  /** 吸引后权重总和 */
  afterWeight: number;
  /** 基础概率（%） */
  pBefore: number;
  /** 吸引后概率（%） */
  pAfter: number;
  /** 概率变化（pAfter - pBefore） */
  delta: number;
  /** 概率倍率（pAfter / pBefore；基础为 0 时为 null） */
  ratio: number | null;
  /** 命中的吸引属性 */
  matchedTyping: string[];
  /** 命中的吸引蛋组 */
  matchedEggGroups: string[];
  /** 是否被 ev 过滤 */
  blockedByEv: boolean;
}

/** 场景条目（含物种信息与权重计算中间值） */
interface ScenarioEntry {
  entry: PoolEntry;
  species: SpeciesInfo | null;
  baseWeight: number;
  afterWeight: number;
  result: SpeciesWeightResult;
}

/** 计算结果 */
export interface ImpactResult {
  /** 按物种汇总后的影响列表（按 pAfter 降序） */
  species: SpeciesImpact[];
  /** 基础桶权重 */
  bucketBefore: Record<string, number>;
  /** 归一化后的桶权重 */
  bucketAfter: Record<string, number>;
  /** 稀有度层级 */
  rarityTier: number;
  /** 汇总统计 */
  summary: {
    /** 场景内物种总数 */
    totalSpecies: number;
    /** 概率上升的物种数 */
    boosted: number;
    /** 概率下降的物种数 */
    reduced: number;
    /** 不变/无法判断的物种数 */
    neutral: number;
    /** 被 ev 完全过滤的物种数 */
    blocked: number;
    /** 未在物种数据中找到的物种数 */
    unknown: number;
  };
}

/**
 * 计算吸引效果对指定场景下宝可梦刷新概率的影响。
 * 源码位置：
 * - api/spawning/spawner/Spawner.kt:176-190（chooseBucket：桶权重先经各 influence 的
 *   affectBucketWeights 调整，再按调整后权重加权选桶，仅保留生成池内出现的桶）
 * - api/spawning/influence/BucketNormalizingInfluence.kt:35-47（桶权重取 w^(1/n) 后归一化）
 * - api/spawning/spawner/Spawner.kt:86-98（calculateSpawnActionForPosition：
 *   选桶 -> 桶内按条目影响后权重加权选择）
 * 算法：
 * 1. 按 pokeSnackBuckets 权重选桶；若 rarityTier > 0，桶权重取 w^(1/n) 后归一到 100
 * 2. 桶内按条目权重加权选择（基础 vs 吸引后）
 * 3. 按物种汇总概率并给出前后对比
 */
export function computeImpact(
  data: AllTheMonsData,
  scenario: Scenario,
  materialIds: string[],
): ImpactResult {
  const lure = resolveLure(materialIds, data);
  const raw = lure.raw;
  const pool = filterScenarioPool(data, scenario);

  const entries: ScenarioEntry[] = pool.map((entry) => {
    const species = data.species[entry.p] ?? null;
    const result = computeSpeciesWeight(species, raw);
    // 基础权重 × 场景权重倍率（天气 / 时间 / 群系）——场景条件同样作用于基础概率
    const baseWeight = entry.weight * weightMultiplierProduct(entry, scenario);
    // 基础权重 × 吸引影响
    const afterWeight = result.weight * baseWeight;
    return { entry, species, baseWeight, afterWeight, result };
  });

  // 桶权重：仅保留场景内出现的桶，并归一化到总和 100。
  // 与游戏 chooseBucket 一致：稀有度层级 > 0 时对权重取 w^(1/n) 再归一化（稀有度拉平）。
  const usedBuckets = new Set(entries.map((e) => e.entry.bucket));
  const rawBucketEntries = Object.entries(POKE_SNACK_BUCKETS).filter(([name]) =>
    usedBuckets.has(name),
  );
  const totalRaw = rawBucketEntries.reduce((s, [, w]) => s + w, 0);

  const bucketBefore: Record<string, number> = {};
  for (const [name, weight] of rawBucketEntries) {
    bucketBefore[name] = totalRaw > 0 ? (weight / totalRaw) * 100 : 0;
  }

  const bucketAfter: Record<string, number> = {};
  if (lure.rarityTier > 0) {
    const nf = BUCKET_FIRST_TIER + BUCKET_GRADIENT * (lure.rarityTier - 1);
    const transformed = rawBucketEntries.map(
      ([name, weight]) => [name, weight ** (1 / nf)] as const,
    );
    const totalTransformed = transformed.reduce((s, [, v]) => s + v, 0);
    for (const [name, value] of transformed) {
      bucketAfter[name] = totalTransformed > 0 ? (value / totalTransformed) * 100 : 0;
    }
  } else {
    Object.assign(bucketAfter, bucketBefore);
  }

  // 按桶分别计算概率
  const speciesMap = new Map<
    string,
    {
      id: string;
      types: string[];
      buckets: Set<string>;
      posTypes: Set<string>;
      baseWeight: number;
      afterWeight: number;
      pBefore: number;
      pAfter: number;
      matchedTyping: Set<string>;
      matchedEggGroups: Set<string>;
      blocked: boolean;
      unknown: boolean;
    }
  >();

  const ensure = (id: string, species: SpeciesInfo | null) => {
    let item = speciesMap.get(id);
    if (!item) {
      item = {
        id,
        types: species?.types ?? [],
        buckets: new Set(),
        posTypes: new Set(),
        baseWeight: 0,
        afterWeight: 0,
        pBefore: 0,
        pAfter: 0,
        matchedTyping: new Set(),
        matchedEggGroups: new Set(),
        blocked: false,
        unknown: species === null,
      };
      speciesMap.set(id, item);
    }
    return item;
  };

  // 预计算每个桶的权重和，避免嵌套循环
  const sumByBucket = new Map<string, { base: number; after: number }>();
  for (const entry of entries) {
    const acc = sumByBucket.get(entry.entry.bucket) ?? { base: 0, after: 0 };
    acc.base += entry.baseWeight;
    acc.after += entry.afterWeight;
    sumByBucket.set(entry.entry.bucket, acc);
  }

  for (const entry of entries) {
    const bucketWeightBefore = bucketBefore[entry.entry.bucket] ?? 0;
    const bucketWeightAfter = bucketAfter[entry.entry.bucket] ?? 0;
    const sums = sumByBucket.get(entry.entry.bucket) ?? { base: 0, after: 0 };

    const pBefore = sums.base > 0 ? (bucketWeightBefore / 100) * (entry.baseWeight / sums.base) : 0;
    const pAfter =
      sums.after > 0 ? (bucketWeightAfter / 100) * (entry.afterWeight / sums.after) : 0;

    const item = ensure(entry.entry.p, entry.species);
    item.buckets.add(entry.entry.bucket);
    item.posTypes.add(entry.entry.pos);
    item.baseWeight += entry.baseWeight;
    item.afterWeight += entry.afterWeight;
    item.pBefore += pBefore;
    item.pAfter += pAfter;
    if (entry.result.matchedTyping) {
      item.matchedTyping.add(entry.result.matchedTyping);
    }
    entry.result.matchedEggGroups.forEach((g) => item.matchedEggGroups.add(g));
    if (entry.result.weight === 0) {
      item.blocked = true;
    }
  }

  const speciesImpacts: SpeciesImpact[] = [...speciesMap.values()]
    .map((item) => {
      const ratio = item.pBefore > 0 ? item.pAfter / item.pBefore : null;
      return {
        id: item.id,
        types: item.types,
        buckets: [...item.buckets],
        posTypes: [...item.posTypes],
        baseWeight: item.baseWeight,
        afterWeight: item.afterWeight,
        pBefore: item.pBefore * 100,
        pAfter: item.pAfter * 100,
        delta: item.pAfter * 100 - item.pBefore * 100,
        ratio,
        matchedTyping: [...item.matchedTyping],
        matchedEggGroups: [...item.matchedEggGroups],
        blockedByEv: item.blocked,
      };
    })
    .sort((a, b) => b.pAfter - a.pAfter);

  const summary = {
    totalSpecies: speciesImpacts.length,
    boosted: speciesImpacts.filter((s) => s.delta > 1e-9).length,
    reduced: speciesImpacts.filter((s) => s.delta < -1e-9).length,
    neutral: speciesImpacts.filter((s) => Math.abs(s.delta) <= 1e-9).length,
    blocked: speciesImpacts.filter((s) => s.blockedByEv).length,
    unknown: [...speciesMap.values()].filter((item) => item.unknown).length,
  };

  return {
    species: speciesImpacts,
    bucketBefore,
    bucketAfter,
    rarityTier: lure.rarityTier,
    summary,
  };
}
