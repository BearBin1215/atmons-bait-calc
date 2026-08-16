import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation, Trans } from "react-i18next";
import { HelpCircleIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { normalizeLocale } from "@/lib/i18n";
import {
  computeImpact,
  EV_STAT_KEYS,
  resolveLure,
  type ImpactResult,
  type LightRange,
  type Scenario,
  type SpeciesImpact,
  type Weather,
} from "@/lib/calc";
import {
  BUCKET_RARITY_INDEX,
  EV_STAT_ORDER,
  LIGHT_VALUES,
  MATERIAL_CATEGORY_ORDER,
  POSITION_VALUES,
  TYPE_COLORS,
  WEATHER_VALUES,
} from "@/lib/labels";
import { loadAllTheMonsData } from "@/lib/loader";
import type { AllTheMonsData, MaterialInfo, SpawnBait } from "@/lib/types";

/** 材料槽位上限（对应游戏内烹饪锅的调料槽数量） */
const MAX_MATERIALS = 3;

/** 稀有度筛选值（按 超稀有 → 普通 排序），名称由 i18n 字典提供 */
const RARITY_VALUES = ["ultra-rare", "rare", "uncommon", "common"] as const;

/** 当前语言解析后的界面标签映射（由数据文件 labels.json 派生） */
interface UiLabels {
  /** 属性 id -> 名称 */
  types: Record<string, string>;
  /** 能力值 id -> 名称 */
  stats: Record<string, string>;
  /** 蛋群 id -> 名称 */
  eggGroups: Record<string, string>;
}

/** 生成带下划线样式、新标签页打开的外部链接元素 */
function extLink(href: string, text: string) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="underline underline-offset-4 hover:text-primary"
    >
      {text}
    </a>
  );
}

/** 格式化概率为百分比字符串：小于 1% 保留 3 位小数，否则保留 2 位 */
function fmtPct(value: number): string {
  return `${value.toFixed(value < 1 ? 3 : 2)}%`;
}

/** 格式化概率倍率：无倍率显示 —，≥100 倍视为无穷显示 ∞ */
function fmtRatio(ratio: number | null): string {
  if (ratio === null) {
    return "—";
  }
  if (ratio >= 100) {
    return "∞";
  }
  return `${ratio.toFixed(2)}×`;
}

/**
 * 解析效果 / 材料子类别的本地化名称。
 * 分类可能是效果类型（带 cobblemon: 前缀）或材料分类，统一去掉前缀后匹配：
 * typing -> 属性、egg_group -> 蛋群、ev 经 EV_STAT_KEYS 映射为能力值键，
 * 其余分类原样返回末段 id；子类别可能带路径（如 a/b/steel），统一取末段。
 */
function categoryLabel(category: string, subcategory: string, labels: UiLabels): string {
  const kind = category.replace(/^cobblemon:/, "");
  const path = subcategory.includes("/") ? subcategory.split("/").pop()! : subcategory;
  if (kind === "typing") {
    return labels.types[path] ?? path;
  }
  if (kind === "egg_group") {
    return labels.eggGroups[path] ?? path;
  }
  if (kind === "ev") {
    const statKey = EV_STAT_KEYS[path] ?? path;
    return labels.stats[statKey] ?? statKey;
  }
  return path;
}

/** 生成材料名称后缀（属性 / 蛋组 / 能力值本地化名称，以 / 连接） */
function materialSuffix(material: MaterialInfo, labels: UiLabels): string {
  if (material.category === "other") {
    return "";
  }
  return material.detail
    .map((d) => categoryLabel(material.category, d, labels))
    .filter(Boolean)
    .join("/");
}

/** 属性徽章（按属性类型颜色着色） */
function TypeChip({ type, label }: { type: string; label: string }) {
  const color = TYPE_COLORS[type] ?? "#999999";
  return (
    <span
      className="inline-flex items-center rounded-sm px-1.5 py-0.5 text-[0.65rem] font-medium text-white"
      style={{ backgroundColor: color }}
    >
      {label}
    </span>
  );
}

/** kind=item 且配有物品图标的材料 -> 图片扩展名（文件位于 public/icons/items/，未列出的 item 无图标） */
const ITEM_ICON_EXTS: Record<string, string> = {
  allthemodium_apple: "png",
  allthemodium_carrot: "png",
  apple: "png",
  enchanted_golden_apple: "gif",
  glistering_melon_slice: "png",
  glow_berries: "png",
  golden_apple: "png",
  golden_carrot: "png",
  sweet_berries: "png",
};

/** 图标静态资源根（public/icons/，随站点部署不经过构建处理） */
const ICONS_BASE = `${import.meta.env.BASE_URL}icons/`;

/**
 * 材料物品图标 URL：
 * - 树果 -> public/icons/berries/<物品id>.png（全部树果均有，来源 Cobblemon 仓库）
 * - 其他物品 -> public/icons/items/<物品id>.<ext>（仅 ITEM_ICON_EXTS 列出的材料有）
 * - 调料（如神话桃桃果）与未列出的整合包物品暂无图标，返回 null
 */
function materialIconUrl(material: MaterialInfo): string | null {
  const itemName = material.id.slice(material.kind.length + 1);
  if (material.kind === "berry") {
    return [ICONS_BASE, "berries/", itemName, ".png"].join("");
  }
  const extension = material.kind === "item" ? (ITEM_ICON_EXTS[itemName] ?? null) : null;
  return extension ? [ICONS_BASE, "items/", itemName, ".", extension].join("") : null;
}

/** 材料图标（16px 显示，像素风格外观保留） */
function MaterialIcon({ material }: { material: MaterialInfo }) {
  const url = materialIconUrl(material);
  if (!url) {
    return null;
  }
  return (
    <img
      src={url}
      alt=""
      loading="lazy"
      className="size-4 shrink-0 [image-rendering:pixelated]"
    />
  );
}

/**
 * 材料选择面板：搜索框 + 已选槽位 + 按显示分类分组的可选材料芯片。
 * 搜索同时匹配中英文名、id 与口味值；基础点数类材料按常用能力值顺序排列。
 */
function MaterialSelector({
  materials,
  selected,
  maxCount,
  labels,
  baitEffects,
  onAdd,
  onRemoveAt,
  onClear,
}: {
  materials: MaterialInfo[];
  selected: string[];
  maxCount: number;
  /** 当前语言的标签映射（用于材料后缀） */
  labels: UiLabels;
  /** 效果数据（「其他」分类材料悬浮显示效果明细） */
  baitEffects: Record<string, SpawnBait>;
  onAdd: (id: string) => void;
  onRemoveAt: (index: number) => void;
  onClear: () => void;
}) {
  const { t, i18n } = useTranslation();
  const locale = normalizeLocale(i18n.language);
  const [search, setSearch] = useState("");
  const keyword = search.trim().toLowerCase();

  const groups = useMemo(() => {
    const result: Record<string, MaterialInfo[]> = {};
    for (const m of materials) {
      const haystack =
        `${m.names.zh} ${m.names.en} ${m.id} ${m.flavours ? Object.keys(m.flavours).join(" ") : ""}`.toLowerCase();
      if (keyword && !haystack.includes(keyword)) {
        continue;
      }
      (result[m.category] ??= []).push(m);
    }
    return result;
  }, [materials, keyword]);

  const slots = Array.from({ length: maxCount }, (_, i) => selected[i] ?? null);

  return (
    <TooltipProvider>
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Input
            placeholder={t("material.placeholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1"
          />
          <Button variant="outline" size="sm" onClick={onClear}>
            {t("material.clear", { count: selected.length, max: maxCount })}
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          {slots.map((id, index) => {
            const material = id ? materials.find((m) => m.id === id) : null;
            if (!id) {
              return (
                <div
                  key={index}
                  className="flex h-9 items-center rounded-md border border-dashed border-muted-foreground/40 px-2.5 text-xs text-muted-foreground"
                >
                  {t("material.emptySlot", { index: index + 1 })}
                </div>
              );
            }
            return (
              <button
                key={index}
                type="button"
                aria-label={t("material.remove", {
                  name: material?.names[locale] ?? "",
                })}
                onClick={() => onRemoveAt(index)}
                className="flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-primary bg-primary/10 px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-primary/20"
              >
                {material && <MaterialIcon material={material} />}
                {material?.names[locale]}
                <span aria-hidden="true" className="text-muted-foreground">
                  ×
                </span>
              </button>
            );
          })}
        </div>

        <p className="text-xs text-muted-foreground">{t("material.hint")}</p>

        {MATERIAL_CATEGORY_ORDER.map((category) => {
          let list = groups[category];
          if (!list || list.length === 0) {
            return null;
          }
          if (category === "ev") {
            list = [...list].sort(
              (a, b) =>
                (EV_STAT_ORDER[a.detail[0] ?? ""] ?? 99) -
                (EV_STAT_ORDER[b.detail[0] ?? ""] ?? 99),
            );
          }
          return (
            <div key={category} className="space-y-1.5">
              <div className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                {t(`materialCategory.${category}`)}
                {t("materialCategory.count", { count: list.length })}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {list.map((m) => {
                  const count = selected.filter((id) => id === m.id).length;
                  const active = count > 0;
                  const full = selected.length >= maxCount;
                  const suffix = materialSuffix(m, labels);
                  let chipClass =
                    "border-border bg-card/40 text-muted-foreground hover:bg-secondary/50 hover:text-foreground";
                  if (active) {
                    chipClass =
                      "border-primary bg-primary/15 font-medium text-foreground";
                  } else if (full) {
                    chipClass =
                      "cursor-not-allowed border-border bg-card/20 text-muted-foreground/40";
                  }
                  const chip = (
                    <button
                      type="button"
                      disabled={full && !active}
                       onClick={() => onAdd(m.id)}
                       className={cn(
                         "inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors",
                         chipClass,
                       )}
                     >
                       <MaterialIcon material={m} />
                       {m.names[locale]}
                      {suffix && <span className="text-muted-foreground">·{suffix}</span>}
                      {count > 1 && ` ×${count}`}
                    </button>
                  );
                  const otherEffects =
                    m.category === "other" ? (baitEffects[m.baitId]?.effects ?? []) : [];
                  if (otherEffects.length === 0) {
                    return <Fragment key={m.id}>{chip}</Fragment>;
                  }
                  return (
                    <Tooltip key={m.id}>
                      <TooltipTrigger render={<span />}>{chip}</TooltipTrigger>
                      <TooltipContent className="block space-y-1">
                        {otherEffects.map((effect, i) => (
                          <div key={i}>
                            {t(`effect.${effect.type}`)}
                            {effect.value > 0 && ` ×${effect.value}`}
                          </div>
                        ))}
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </TooltipProvider>
  );
}

/** 群系选择：可搜索下拉（按名称过滤，#标签 按群系标签过滤） */
function BiomeSelector({
  biomes,
  selected,
  onSelect,
  tagsByBiome,
}: {
  biomes: string[];
  selected: string;
  onSelect: (biome: string) => void;
  tagsByBiome: Record<string, string[]>;
}) {
  const { t } = useTranslation();

  return (
    <div className="space-y-2">
      <Combobox
        items={biomes}
        value={selected}
        onValueChange={(value) => {
          if (value) {
            onSelect(value);
          }
        }}
        filter={(biome, query) => {
          const q = query.trim().toLowerCase();
          if (!q) {
            return true;
          }
          if (q.startsWith("#")) {
            const tagKw = q.slice(1);
            return (tagsByBiome[biome] ?? []).some((tag) =>
              tag.toLowerCase().includes(tagKw),
            );
          }
          return biome.toLowerCase().includes(q);
        }}
      >
        <ComboboxInput placeholder={t("biome.placeholder")} className="w-full" />
        <ComboboxContent>
          <ComboboxEmpty>{t("biome.empty")}</ComboboxEmpty>
          <ComboboxList>
            {(biome) => (
              <ComboboxItem key={biome} value={biome} className="truncate">
                {biome}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      <p className="text-xs text-muted-foreground">
        {t("biome.count", { count: biomes.length })}
      </p>
    </div>
  );
}

/**
 * 场景单选按钮组（光照 / 天气），基于 ToggleGroup 单值模式。
 * ToggleGroup 点击已选项会取消选中（值变空数组），
 * 光照 / 天气必须始终有一项选中，故忽略空数组。
 * 按钮文案由 i18n 字典的 `<prefix>.<value>` 键提供。
 */
function OptionGroup<T extends string>({
  values,
  labelPrefix,
  selected,
  onSelect,
}: {
  /** 选项值列表 */
  values: readonly T[];
  /** i18n 键前缀（light / weather） */
  labelPrefix: string;
  /** 当前选中值 */
  selected: T;
  /** 选中变化回调 */
  onSelect: (value: T) => void;
}) {
  const { t } = useTranslation();
  return (
    <ToggleGroup
      value={[selected]}
      onValueChange={(nextValues) => {
        if (nextValues.length > 0) {
          onSelect(nextValues[0] as T);
        }
      }}
    >
      {values.map((value) => (
        <ToggleGroupItem key={value} value={value} variant="outline" size="sm">
          {t(`${labelPrefix}.${value}`)}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

/**
 * 吸引效果摘要卡片：稀有度等级提升、属性 / 蛋群 / 基础点数 / 上钩时间 /
 * 个体质量各分组。属性分组标题带「仅第一个效果生效」的悬浮提示。
 */
function LureSummaryCard({
  lure,
  labels,
}: {
  lure: ReturnType<typeof resolveLure>;
  /** 当前语言的标签映射 */
  labels: UiLabels;
}) {
  const { t } = useTranslation();
  const hasAny = lure.merged.length > 0 || lure.rarityTier > 0;

  if (!hasAny) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("lure.title")}</CardTitle>
          <CardDescription>{t("lure.empty")}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const typingHint = (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger className="inline-flex size-4 cursor-help items-center justify-center text-muted-foreground/70 transition-colors outline-none hover:text-foreground">
          <HelpCircleIcon className="size-3.5" />
        </TooltipTrigger>
        <TooltipContent>{t("lure.typingHint")}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );

  const renderGroup = (
    title: string,
    effects: ReturnType<typeof resolveLure>["merged"],
    opts?: {
      /** 分组下方的补充说明 */
      note?: string;
      /** 每条目显示效果类型徽章（仅质量组需要，标题无法区分具体效果） */
      showEffectType?: boolean;
      /** 标题旁的悬浮提示 */
      hint?: ReactNode;
    },
  ) => {
    const { note, showEffectType = false, hint } = opts ?? {};
    if (effects.length === 0) {
      return null;
    }
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-1 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
          {title}
          {hint}
        </div>
        <ul className="space-y-1 text-sm">
          {effects.map((effect, index) => (
            <li key={index} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              {showEffectType && (
                <Badge variant="secondary">{t(`effect.${effect.type}`)}</Badge>
              )}
              <span>
                {categoryLabel(effect.type, effect.subcategory ?? "", labels)}
                {effect.value > 0 && ` ×${effect.value}`}
                {effect.chance < 1 &&
                  t("lure.trigger", { chance: (effect.chance * 100).toFixed(0) })}
              </span>
            </li>
          ))}
        </ul>
        {note && <p className="text-xs text-muted-foreground">{note}</p>}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("lure.title")}</CardTitle>
        <CardDescription>{t("lure.description")}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        {lure.rarityTier > 0 && (
          <div className="space-y-1">
            <div className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              {t("lure.rarityBoost")}
            </div>
            <p className="text-sm">
              {t("lure.rarityBoostText", { tier: lure.rarityTier })}
            </p>
          </div>
        )}
        {renderGroup(t("lure.group.typing"), lure.typingEffects, {
          hint: typingHint,
        })}
        {renderGroup(t("lure.group.eggGroup"), lure.eggGroupEffects)}
        {renderGroup(t("lure.group.ev"), lure.evEffects, {
          note: t("lure.group.evNote"),
        })}
        {renderGroup(t("lure.group.biteTime"), lure.biteTimeEffects)}
        {renderGroup(t("lure.group.quality"), lure.qualityEffects, {
          showEffectType: true,
        })}
      </CardContent>
    </Card>
  );
}

/** 结果表排序键 */
type SortKey = "rarity" | "pAfter" | "pBefore" | "name";
/** 各排序键的默认方向 */
const SORT_DEFAULT_DIR: Record<SortKey, "asc" | "desc"> = {
  rarity: "asc",
  pAfter: "desc",
  pBefore: "desc",
  name: "asc",
};

/** 物种稀有度排序索引：取各出现桶中最稀有的一档 */
function speciesRarityIndex(s: SpeciesImpact): number {
  return Math.min(...s.buckets.map((b) => BUCKET_RARITY_INDEX[b] ?? 4));
}

/** 可点击排序的表头按钮，激活时显示升降序箭头 */
function SortHeader({
  label,
  sortKey,
  sort,
  onSort,
  className,
}: {
  label: string;
  sortKey: SortKey;
  sort: { key: SortKey; dir: "asc" | "desc" };
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  const active = sort.key === sortKey;
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className={cn(
        "inline-flex items-center gap-1 font-medium whitespace-nowrap",
        className,
        active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
      {active && (sort.dir === "asc" ? "▲" : "▼")}
    </button>
  );
}

/**
 * 影响结果表格：场景标题与汇总统计、名称筛选与稀有度筛选、
 * 可排序列（名称 / 稀有度 / 基础概率 / 吸引后概率）与各物种影响明细。
 */
function ImpactTable({
  impact,
  selectedCount,
  labels,
  namesById,
}: {
  impact: ImpactResult;
  selectedCount: number;
  /** 当前语言的标签映射 */
  labels: UiLabels;
  /** 物种 id -> 当前语言名称（由数据文件派生） */
  namesById: Record<string, string>;
}) {
  const { t, i18n } = useTranslation();
  const locale = normalizeLocale(i18n.language);
  const [nameQuery, setNameQuery] = useState("");
  const [rarityFilter, setRarityFilter] = useState<string[]>([...RARITY_VALUES]);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "rarity",
    dir: "asc",
  });

  const list = useMemo(() => {
    const resolvedName = (s: SpeciesImpact) => namesById[s.id] ?? s.id;
    const keyword = nameQuery.trim().toLowerCase();
    const byName = keyword
      ? impact.species.filter(
          (s) =>
            resolvedName(s).toLowerCase().includes(keyword) ||
            s.id.toLowerCase().includes(keyword),
        )
      : impact.species;
    const filtered =
      rarityFilter.length === 0
        ? byName
        : byName.filter((s) => s.buckets.some((b) => rarityFilter.includes(b)));
    const dirMul = sort.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sort.key === "name") {
        return dirMul * resolvedName(a).localeCompare(resolvedName(b), locale);
      }
      if (sort.key === "pAfter") {
        return dirMul * (a.pAfter - b.pAfter);
      }
      if (sort.key === "pBefore") {
        return dirMul * (a.pBefore - b.pBefore);
      }
      const ra = speciesRarityIndex(a);
      const rb = speciesRarityIndex(b);
      if (ra !== rb) {
        return dirMul * (ra - rb);
      }
      return b.pAfter - a.pAfter;
    });
  }, [impact, nameQuery, rarityFilter, sort, namesById, locale]);

  const setSortKey = (key: SortKey) => {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: SORT_DEFAULT_DIR[key] },
    );
  };

  const bucketSeparator = t("table.bucketSeparator");

  return (
    <Card>
      <CardHeader>
        <CardDescription>
          {t("table.summary", {
            total: impact.summary.totalSpecies,
            note: selectedCount === 0 ? t("table.summaryBaseNote") : "",
            up: impact.summary.boosted,
            down: impact.summary.reduced,
            blocked: impact.summary.blocked,
          })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <Input
            placeholder={t("table.filterPlaceholder")}
            value={nameQuery}
            onChange={(e) => setNameQuery(e.target.value)}
            className="h-8 w-40"
          />
          <ToggleGroup
            multiple
            value={rarityFilter}
            onValueChange={(values) => setRarityFilter(values)}
            className="gap-1"
          >
            {RARITY_VALUES.map((value) => (
              <ToggleGroupItem
                key={value}
                value={value}
                variant="outline"
                size="sm"
                className="h-7 px-3"
              >
                {t(`rarity.${value}`)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        {impact.species.length === 0 ? (
          <Empty>
            <EmptyTitle>{t("table.empty")}</EmptyTitle>
            <EmptyDescription>{t("table.emptyHint")}</EmptyDescription>
          </Empty>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <SortHeader
                      label={t("table.name")}
                      sortKey="name"
                      sort={sort}
                      onSort={setSortKey}
                    />
                  </TableHead>
                  <TableHead>{t("table.type")}</TableHead>
                  <TableHead>
                    <SortHeader
                      label={t("table.rarity")}
                      sortKey="rarity"
                      sort={sort}
                      onSort={setSortKey}
                    />
                  </TableHead>
                  <TableHead className="text-right">
                    <SortHeader
                      label={t("table.baseProb")}
                      sortKey="pBefore"
                      sort={sort}
                      onSort={setSortKey}
                    />
                  </TableHead>
                  <TableHead className="text-right">
                    <SortHeader
                      label={t("table.afterProb")}
                      sortKey="pAfter"
                      sort={sort}
                      onSort={setSortKey}
                    />
                  </TableHead>
                  <TableHead className="text-right">{t("table.change")}</TableHead>
                  <TableHead>{t("table.baitMatch")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.map((s) => {
                  const boosted = s.delta > 1e-9;
                  const reduced = s.delta < -1e-9;
                  return (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium whitespace-nowrap">
                        {namesById[s.id] ?? s.id}
                        {s.blockedByEv && (
                          <Badge variant="destructive" className="ml-2">
                            {t("table.evFiltered")}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <span className="flex gap-1">
                          {s.types.map((tp) => (
                            <TypeChip key={tp} type={tp} label={labels.types[tp] ?? tp} />
                          ))}
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {s.buckets.map((b) => t(`rarity.${b}`)).join(bucketSeparator)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtPct(s.pBefore)}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {fmtPct(s.pAfter)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right whitespace-nowrap tabular-nums",
                          boosted && "text-green-600",
                          reduced && "text-red-600",
                        )}
                      >
                        {boosted ? "+" : ""}
                        {fmtPct(s.delta)}
                        {s.ratio !== null && ` (${fmtRatio(s.ratio)})`}
                      </TableCell>
                      <TableCell className="min-w-40">
                        <div className="flex flex-wrap gap-1">
                          {s.matchedTyping.map((tp) => (
                            <TypeChip key={tp} type={tp} label={labels.types[tp] ?? tp} />
                          ))}
                          {s.matchedEggGroups.map((g) => (
                            <Badge key={g} variant="outline">
                              {labels.eggGroups[g] ?? g}
                            </Badge>
                          ))}
                          {s.matchedTyping.length === 0 &&
                            s.matchedEggGroups.length === 0 &&
                            !s.blockedByEv && (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * 计算器主组件：加载静态数据，维护材料与场景（群系 / 光照 / 天气 / 生成位置）
 * 状态，计算吸引效果与影响结果，并组装页面各区块。
 */
export default function Calculator() {
  const { t, i18n } = useTranslation();
  const locale = normalizeLocale(i18n.language);

  const [data, setData] = useState<AllTheMonsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [biomeId, setBiomeId] = useState("minecraft:plains");
  const [light, setLight] = useState<LightRange>("day");
  const [weather, setWeather] = useState<Weather>("clear");
  /** 生成位置（单选：宝点心周围地形同时存在多种时，应分次计算） */
  const [posType, setPosType] = useState<string>("grounded");

  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    loadAllTheMonsData()
      .then((d) => setData(d))
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : String(err)),
      );
  }, [reloadKey]);

  const poolTagSet = useMemo(() => {
    const set = new Set<string>();
    if (!data) {
      return set;
    }
    for (const entry of data.spawnPool) {
      for (const b of entry.biomes) {
        set.add(b);
      }
      for (const b of entry.anti) {
        set.add(b);
      }
    }
    return set;
  }, [data]);

  const resolvedBiomeTags = useMemo(() => {
    if (!data) {
      return [];
    }
    return (data.biomeTagReverse[biomeId] ?? []).filter((tag) => poolTagSet.has(tag));
  }, [data, biomeId, poolTagSet]);

  const biomeOptions = useMemo(
    () =>
      data
        ? Object.keys(data.biomeTagReverse)
            .filter((b) =>
              (data.biomeTagReverse[b] ?? []).some((tag) => poolTagSet.has(tag)),
            )
            .sort()
        : [],
    [data, poolTagSet],
  );

  const scenario: Scenario = useMemo(
    () => ({ biomeTags: resolvedBiomeTags, light, weather, posTypes: [posType] }),
    [resolvedBiomeTags, light, weather, posType],
  );

  const lure = useMemo(
    () => (data ? resolveLure(selected, data) : null),
    [data, selected],
  );

  const impact = useMemo(
    () => (data ? computeImpact(data, scenario, selected) : null),
    [data, scenario, selected],
  );

  /** 当前语言解析后的界面标签映射 */
  const labels: UiLabels = useMemo(() => {
    if (!data) {
      return { types: {}, stats: {}, eggGroups: {} };
    }
    return {
      types: data.labels.types[locale],
      stats: data.labels.stats[locale],
      eggGroups: data.labels.eggGroups[locale],
    };
  }, [data, locale]);

  /** 物种 id -> 当前语言名称（zh 缺失时回退 en） */
  const namesById = useMemo(() => {
    const map: Record<string, string> = {};
    if (data) {
      for (const sp of Object.values(data.species)) {
        map[sp.id] = sp.names[locale] ?? sp.names.en;
      }
    }
    return map;
  }, [data, locale]);

  const versionText = (() => {
    const v = data?.meta.versions;
    if (!v?.allTheMons && !v?.cobblemon) {
      return "";
    }
    return t("intro.version", {
      atm: v.allTheMons ?? "?",
      cobblemon: v.cobblemon ?? "?",
    });
  })();

  if (error) {
    return (
      <div className="space-y-4">
        <Empty>
          <EmptyTitle>{t("page.loadFailed")}</EmptyTitle>
          <EmptyDescription>{error}</EmptyDescription>
          <Button variant="outline" onClick={() => setReloadKey((k) => k + 1)}>
            {t("page.retry")}
          </Button>
        </Empty>
      </div>
    );
  }

  if (!data || !lure || !impact) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner />
        {t("page.loading")}
      </div>
    );
  }

  /** 追加材料到下一个空槽位（已满则忽略） */
  const addMaterial = (id: string) => {
    setSelected((prev) => {
      if (prev.length >= MAX_MATERIALS) {
        return prev;
      }
      return [...prev, id];
    });
  };

  /** 移除指定槽位的材料 */
  const removeSlot = (index: number) => {
    setSelected((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      <p className="text-sm">
        <Trans
          i18nKey="intro.description"
          components={{
            atm: extLink(
              "https://www.curseforge.com/minecraft/modpacks/all-the-mons",
              "All The Mons",
            ),
            cobblemon: extLink(
              "https://www.curseforge.com/minecraft/mc-mods/cobblemon",
              "Cobblemon",
            ),
          }}
        />
      </p>
      <p className="text-xs text-muted-foreground">
        {t("intro.snapshot", {
          time: new Date(data.meta.generatedAt).toLocaleString(),
          version: versionText,
          species: data.meta.counts.species,
          pool: data.meta.counts.spawnPool,
          materials: data.meta.counts.materials,
        })}
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("material.title")}</CardTitle>
            <CardDescription>
              {t("material.description", { max: MAX_MATERIALS })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <MaterialSelector
              materials={data.materials}
              selected={selected}
              maxCount={MAX_MATERIALS}
              labels={labels}
              baitEffects={data.baitEffects}
              onAdd={addMaterial}
              onRemoveAt={removeSlot}
              onClear={() => setSelected([])}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("scenario.title")}</CardTitle>
            <CardDescription>{t("scenario.description")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t("scenario.biome")}</Label>
              <BiomeSelector
                biomes={biomeOptions}
                selected={biomeId}
                onSelect={setBiomeId}
                tagsByBiome={data.biomeTagReverse}
              />
              {resolvedBiomeTags.length > 0 ? (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">
                    {t("scenario.tags", { count: resolvedBiomeTags.length })}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {resolvedBiomeTags.map((tag) => (
                      <Badge key={tag} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-destructive">{t("scenario.tagsEmpty")}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>{t("scenario.light")}</Label>
              <OptionGroup
                values={LIGHT_VALUES}
                labelPrefix="light"
                selected={light}
                onSelect={setLight}
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t("scenario.weather")}</Label>
              <OptionGroup
                values={WEATHER_VALUES}
                labelPrefix="weather"
                selected={weather}
                onSelect={setWeather}
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t("scenario.position")}</Label>
              <OptionGroup
                values={POSITION_VALUES}
                labelPrefix="position"
                selected={posType}
                onSelect={setPosType}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <LureSummaryCard lure={lure} labels={labels} />

      <ImpactTable
        impact={impact}
        selectedCount={selected.length}
        labels={labels}
        namesById={namesById}
      />

      <Card>
        <CardHeader>
          <CardTitle>{t("algo.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>{t("algo.model")}</p>
          <p>{t("algo.slots", { max: MAX_MATERIALS })}</p>
          <p>{t("algo.source")}</p>
          <p>{t("algo.data")}</p>
          <p>{t("algo.aiNote")}</p>
        </CardContent>
      </Card>
    </div>
  );
}
