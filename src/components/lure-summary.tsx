/** 吸引效果摘要内容组件 */
import { useTranslation } from "react-i18next";
import type { ReactNode } from "react";
import { HelpCircleIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { resolveLure } from "@/lib/calc";
import type { BaitEffect } from "@/lib/types";
import { type UiLabels, categoryLabel } from "@/components/shared";

/** 是否存在任意吸引效果（供卡片标题描述与内容渲染共同判断） */
export function hasLureEffects(lure: ReturnType<typeof resolveLure>): boolean {
  return lure.merged.length > 0 || lure.rarityTier > 0;
}

/**
 * 吸引效果摘要内容：不分组，逐行展示合并后的各效果
 * （稀有度提升、属性 / 蛋群吸引、基础点数、上钩时间、个体质量）。
 * 属性与基础点数行末尾带问号悬浮提示（仅首个生效 / 权重归 0 说明）。
 */
export function LureSummary({
  lure,
  labels,
}: {
  lure: ReturnType<typeof resolveLure>;
  /** 当前语言的标签映射 */
  labels: UiLabels;
}) {
  const { t } = useTranslation();

  if (!hasLureEffects(lure)) {
    return null;
  }

  /** 行末问号悬浮提示图标 */
  const hintIcon = (tooltip: string) => (
    <Tooltip>
      <TooltipTrigger className="inline-flex size-4 cursor-help items-center justify-center text-muted-foreground/70 transition-colors outline-none hover:text-foreground">
        <HelpCircleIcon className="size-3.5" />
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );

  /** 单条效果行：效果类型名 + 子类别 + 倍率（+ 触发概率与行末提示） */
  const renderRow = (effect: BaitEffect, key: string, hint?: ReactNode) => {
    const sub = effect.subcategory
      ? categoryLabel(effect.type, effect.subcategory, labels)
      : "";
    return (
      <li key={key} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <span className="text-muted-foreground">{t(`effect.${effect.type}`)}</span>
        {sub && <span>{sub}</span>}
        {effect.value > 0 && <span>×{effect.value}</span>}
        {effect.chance < 1 &&
          t("lure.trigger", { chance: (effect.chance * 100).toFixed(0) })}
        {hint}
      </li>
    );
  };

  return (
    <ul className="space-y-1 text-sm">
      {lure.rarityTier > 0 && (
        <li className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="text-muted-foreground">
            {t("effect.cobblemon:rarity_bucket")}
          </span>
          <span>+{lure.rarityTier}</span>
        </li>
      )}
      {lure.typingEffects.map((e, i) =>
        renderRow(e, `${e.type}:${e.subcategory}:${i}`, hintIcon(t("lure.typingHint"))),
      )}
      {lure.eggGroupEffects.map((e, i) =>
        renderRow(e, `${e.type}:${e.subcategory}:${i}`),
      )}
      {lure.evEffects.map((e, i) =>
        renderRow(e, `${e.type}:${e.subcategory}:${i}`, hintIcon(t("lure.evNote"))),
      )}
      {lure.biteTimeEffects.map((e, i) =>
        renderRow(e, `${e.type}:${e.subcategory}:${i}`),
      )}
      {lure.qualityEffects.map((e, i) => renderRow(e, `${e.type}:${e.subcategory}:${i}`))}
    </ul>
  );
}
