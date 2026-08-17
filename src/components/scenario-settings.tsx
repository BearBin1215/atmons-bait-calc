/**
 * 场景设置内容组件：群系选择（可搜索下拉，支持 #标签 过滤）、已解析标签展示、
 * 光照 / 天气 / 生成位置单选按钮组。
 */
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { LightRange, Weather } from "@/lib/calc";
import { LIGHT_VALUES, POSITION_VALUES, WEATHER_VALUES } from "@/lib/labels";

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
 * 场景单选按钮组（光照 / 天气 / 生成位置），基于 ToggleGroup 单值模式。
 * ToggleGroup 点击已选项会取消选中（值变空数组），
 * 各选项必须始终有一项选中，故忽略空数组。
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
  /** i18n 键前缀（light / weather / position） */
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

/** 场景设置内容组件（群系 / 光照 / 天气 / 生成位置） */
export function ScenarioSettings({
  biomes,
  biomeId,
  onBiomeChange,
  tagsByBiome,
  biomeTags,
  light,
  onLightChange,
  weather,
  onWeatherChange,
  posType,
  onPosTypeChange,
}: {
  /** 可选群系列表（仅保留生成池涉及的群系） */
  biomes: string[];
  /** 当前选中群系 id */
  biomeId: string;
  onBiomeChange: (biome: string) => void;
  /** 群系 id -> 所属标签列表（数据文件派生） */
  tagsByBiome: Record<string, string[]>;
  /** 当前群系解析出的、生成池用到的标签 */
  biomeTags: string[];
  light: LightRange;
  onLightChange: (light: LightRange) => void;
  weather: Weather;
  onWeatherChange: (weather: Weather) => void;
  /** 生成位置（宝点心周围地形同时存在多种时，应分次计算） */
  posType: string;
  onPosTypeChange: (posType: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="space-y-1.5">
        <Label>{t("scenario.biome")}</Label>
        <BiomeSelector
          biomes={biomes}
          selected={biomeId}
          onSelect={onBiomeChange}
          tagsByBiome={tagsByBiome}
        />
        {biomeTags.length > 0 ? (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">
              {t("scenario.tags", { count: biomeTags.length })}
            </p>
            <div className="flex flex-wrap gap-1">
              {biomeTags.map((tag) => (
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

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>{t("scenario.light")}</Label>
          <OptionGroup
            values={LIGHT_VALUES}
            labelPrefix="light"
            selected={light}
            onSelect={onLightChange}
          />
        </div>

        <div className="space-y-1.5">
          <Label>{t("scenario.weather")}</Label>
          <OptionGroup
            values={WEATHER_VALUES}
            labelPrefix="weather"
            selected={weather}
            onSelect={onWeatherChange}
          />
        </div>

        <div className="space-y-1.5">
          <Label>{t("scenario.position")}</Label>
          <OptionGroup
            values={POSITION_VALUES}
            labelPrefix="position"
            selected={posType}
            onSelect={onPosTypeChange}
          />
        </div>
      </div>
    </div>
  );
}
