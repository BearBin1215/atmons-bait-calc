/** 影响结果表格内容组件（筛选、排序与各物种明细） */
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { normalizeLocale } from "@/lib/i18n";
import type { ImpactResult, SpeciesImpact } from "@/lib/calc";
import { BUCKET_RARITY_INDEX, TYPE_COLORS } from "@/lib/labels";
import { type UiLabels, fmtPct, fmtPctPrecise, fmtRatio } from "@/components/shared";

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

/** 稀有度筛选值（按 超稀有 -> 普通 排序），名称由 i18n 字典提供 */
const RARITY_VALUES = ["ultra-rare", "rare", "uncommon", "common"] as const;

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
        "inline-flex cursor-pointer items-center gap-1 font-medium whitespace-nowrap",
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
 * 概率数值文本：常规按 fmtPct 截断显示，悬浮始终显示高精度值（fmtPctPrecise），
 * 以虚线下划线提示可悬浮（如 0.00004% 显示为 0.000%，悬浮可见精确值）。
 */
function ProbText({ value }: { value: number }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={<span />}
        className="cursor-help underline decoration-dotted underline-offset-4"
      >
        {fmtPct(value)}
      </TooltipTrigger>
      <TooltipContent>{fmtPctPrecise(value)}</TooltipContent>
    </Tooltip>
  );
}

/**
 * 影响结果表格内容：名称筛选与稀有度筛选、
 * 可排序列（名称 / 稀有度 / 基础概率 / 吸引后概率）与各物种影响明细。
 */
export function ImpactTable({
  impact,
  labels,
  namesById,
}: {
  impact: ImpactResult;
  /** 当前语言的标签映射 */
  labels: UiLabels;
  /** 物种 id -> 当前语言名称（由数据文件派生） */
  namesById: Record<string, string>;
}) {
  const { t, i18n } = useTranslation();
  const locale = normalizeLocale(i18n.language);
  const [nameQuery, setNameQuery] = useState("");
  const [rarityFilter, setRarityFilter] = useState<string[]>(["ultra-rare", "rare"]);
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
            resolvedName(s).toLowerCase().includes(keyword) || s.id.toLowerCase().includes(keyword),
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
    <div className="space-y-3">
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
                    <TableCell className="text-right tabular-nums">{fmtPct(s.pBefore)}</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      <ProbText value={s.pAfter} />
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
                            <span className="text-xs text-muted-foreground">-</span>
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
    </div>
  );
}
