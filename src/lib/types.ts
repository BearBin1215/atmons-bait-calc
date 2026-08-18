/**
 * All the Mons 宝点心（Poke Snack / Lure）吸引计算的数据类型定义。
 * 对应源码数据：spawn_bait_effects、berries、seasonings、species、spawn_pool_world。
 */

/** 单个吸引效果，对应源码 SpawnBait.Effect */
export interface BaitEffect {
  /** 效果类型，如 cobblemon:typing、cobblemon:egg_group、cobblemon:ev */
  type: string;
  /** 子类别（类型名/蛋群/属性名等），可为空 */
  subcategory: string | null;
  /** 触发概率（0~1） */
  chance: number;
  /** 效果数值（如类型吸引力倍率、稀有度层级） */
  value: number;
}

/** 一个吸引物品的完整定义，对应源码 SpawnBait */
export interface SpawnBait {
  /** 物品 id，如 cobblemon:pecha_berry */
  item: string;
  effects: BaitEffect[];
}

/** 材料种类 */
export type MaterialKind = "berry" | "item" | "seasoning";

/** 材料显示分类（属性 / 蛋群 / 基础点数 / 其他） */
export type MaterialCategory = "typing" | "egg_group" | "ev" | "other";

/** 可选材料（树果 / 其他物品 / 调料） */
export interface MaterialInfo {
  /** 唯一 id，如 berry:pecha_berry */
  id: string;
  kind: MaterialKind;
  /** 多语言显示名（zh / en 均从语言文件或数据兜底解析） */
  names: {
    /** 中文名 */
    zh: string;
    /** 英文名 */
    en: string;
  };
  /** 指向 bait-effects.json 的键 */
  baitId: string;
  /** 口味值，可为空 */
  flavours: Record<string, number> | null;
  /** 显示分类 */
  category: MaterialCategory;
  /** 分类对应的子类别 id（属性名 / 蛋组名 / 能力名），供名称后缀展示 */
  detail: string[];
}

/** 物种信息（精简自 species JSON） */
export interface SpeciesInfo {
  /** 物种 id，如 charmander */
  id: string;
  /** 多语言名称（en 恒有，zh 可能缺失） */
  names: {
    /** 中文名（来自 zh_cn 语言文件） */
    zh: string | null;
    /** 英文名 */
    en: string;
  };
  /** 属性列表 */
  types: string[];
  /** 蛋群列表 */
  eggGroups: string[];
  /** EV 产量（仅非 0 项），键为属性名如 special_attack */
  evYield: Record<string, number>;
}

/** 权重倍率条件（仅保留本工具可评估的字段） */
export interface WeightMultiplierCondition {
  isRaining?: boolean;
  isThundering?: boolean;
  timeRange?: string;
  biomes?: string[];
}

/** 权重倍率：满足条件时按 multiplier 乘权重（影响概率） */
export interface WeightMultiplier {
  multiplier: number;
  condition: WeightMultiplierCondition;
  anticondition: WeightMultiplierCondition;
}

/** 世界生成池条目（精简自 spawn_pool_world） */
export interface PoolEntry {
  /** 物种 id */
  p: string;
  /** 稀有度桶：common / uncommon / rare / ultra-rare */
  bucket: string;
  /** 基础权重 */
  weight: number;
  /** 生成位置类型：grounded / surface / submerged / seafloor / fishing */
  pos: string;
  /** 条件生物群系标签/ID 列表 */
  biomes: string[];
  /** 最低天空光照（LightLayer.SKY，受遮挡/维度影响，不随昼夜变化） */
  minSkyLight: number | null;
  /** 最高天空光照（LightLayer.SKY，受遮挡/维度影响，不随昼夜变化） */
  maxSkyLight: number | null;
  /** 最低环境亮度（Cobblemon 的 SpawnablePosition.light） */
  minLocalLight: number | null;
  /** 最高环境亮度（Cobblemon 的 SpawnablePosition.light） */
  maxLocalLight: number | null;
  /** 昼夜时段条件（day / night / dusk；null=无限制） */
  timeRange: string | null;
  /** 需要所在的维度 id 列表（空列表表示不限制） */
  dimensions: string[];
  /** 允许的月相编号列表（0-7，null=无限制） */
  moonPhases: number[] | null;
  /** 是否仅史莱姆区块（true=仅史莱姆区块，false/null=无限制） */
  slimeChunk: boolean | null;
  /** 是否要求雨天（true=仅雨天，false=仅非雨天，null=无限制） */
  isRaining: boolean | null;
  /** 是否要求雷暴（true=仅雷暴，false=仅非雷暴，null=无限制） */
  isThundering: boolean | null;
  /** 权重倍率列表 */
  weightMultipliers: WeightMultiplier[];
  /** 是否仅垂钓（条件含 minLureLevel，宝点心无法触发） */
  lureOnly: boolean;
  /** 需要的附近特殊方块特征 id 列表（列表内任一命中即可） */
  requiredNearby: string[];
  /** 需要的脚下基底方块特征 id 列表（列表内任一命中即可） */
  requiredBase: string[];
  /** 是否要求露天（true=需露天，false=需不露天，null=无限制） */
  canSeeSky: boolean | null;
  /** 最低生成 Y（null=无限制） */
  minY: number | null;
  /** 最高生成 Y（null=无限制） */
  maxY: number | null;
  /** 需要所在的结构（id 或 #tag，任一命中即可） */
  structures: string[];
  /** 反条件列表：每个条件内部字段全部满足，任一条件命中即排除 */
  antiConditions: SpawnConditionSnapshot[];
}

/**
 * 生成条件快照。反条件必须保留对象边界，否则会把同一条件内的 AND 错误变成字段间 OR。
 */
export interface SpawnConditionSnapshot {
  /** 条件生物群系标签/ID 列表 */
  biomes: string[];
  /** 最低天空光照 */
  minSkyLight: number | null;
  /** 最高天空光照 */
  maxSkyLight: number | null;
  /** 最低环境亮度 */
  minLocalLight: number | null;
  /** 最高环境亮度 */
  maxLocalLight: number | null;
  /** 昼夜时段条件 */
  timeRange: string | null;
  /** 允许的月相编号列表 */
  moonPhases: number[] | null;
  /** 是否仅史莱姆区块 */
  slimeChunk: boolean | null;
  /** 是否要求雨天 */
  isRaining: boolean | null;
  /** 是否要求雷暴 */
  isThundering: boolean | null;
  /** 是否要求露天 */
  canSeeSky: boolean | null;
  /** 最低生成 Y */
  minY: number | null;
  /** 最高生成 Y */
  maxY: number | null;
  /** 需要所在的结构 */
  structures: string[];
  /** 需要的附近方块特征 */
  requiredNearby: string[];
  /** 需要的脚下方块特征 */
  requiredBase: string[];
  /** 需要所在的维度 id */
  dimensions: string[];
}

/** 数据元信息 */
export interface AllTheMonsMeta {
  generatedAt: string;
  /** 数据来源版本（All the Mons / Cobblemon），可能缺失 */
  versions?: {
    allTheMons?: string | null;
    cobblemon?: string | null;
  };
  counts: Record<string, number>;
}

/** 单一分类的语言标签（zh / en），如属性、能力值、蛋群 */
export interface LabelsFile {
  /** 标签 id -> 中文名 */
  zh: Record<string, string>;
  /** 标签 id -> 英文名 */
  en: Record<string, string>;
}

/** labels.json 文件结构：各分类标签翻译（属性 / 能力值 / 蛋群） */
export interface LabelsData {
  /** 属性翻译（cobblemon.type.*） */
  types: LabelsFile;
  /** 能力值翻译（cobblemon.stat.<id>.name） */
  stats: LabelsFile;
  /** 蛋群翻译（cobblemon.egg_group.*） */
  eggGroups: LabelsFile;
}

/** 聚合后的完整数据 */
export interface AllTheMonsData {
  baitEffects: Record<string, SpawnBait>;
  materials: MaterialInfo[];
  species: Record<string, SpeciesInfo>;
  spawnPool: PoolEntry[];
  /** 特征 id -> 数据中实际出现的原始方块/tag 列表（供悬浮提示显示） */
  blockFeatures: Record<string, string[]>;
  /** 群系 id -> 所属标签列表（含通过嵌套标签传递解析，仅限本数据可解析的群系） */
  biomeTagReverse: Record<string, string[]>;
  /** 界面标签翻译（属性 / 能力值 / 蛋群），来自 Cobblemon 语言文件 */
  labels: LabelsData;
  meta: AllTheMonsMeta;
}
