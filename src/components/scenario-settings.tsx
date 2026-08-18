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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type {
  DimensionId,
  LocalLightRange,
  HeightRange,
  MoonPhase,
  SkyExposure,
  SkyVisibility,
  SlimeChunk,
  TimeOfDay,
  Weather,
} from "@/lib/calc";
import {
  DIMENSION_VALUES,
  LOCAL_LIGHT_VALUES,
  HEIGHT_RANGE_VALUES,
  MOON_PHASE_VALUES,
  POSITION_VALUES,
  SKY_EXPOSURE_VALUES,
  SKY_VISIBILITY_VALUES,
  SLIME_CHUNK_VALUES,
  TIME_OF_DAY_VALUES,
  WEATHER_VALUES,
} from "@/lib/labels";

/** 场景设置表单值；与计算层 Scenario 分离，保留界面使用的单选值。 */
export interface ScenarioSettingsValue {
  biomeId: string;
  /** 时段（白天 / 黄昏 / 夜晚） */
  timeOfDay: TimeOfDay;
  /** 所在维度 */
  dimension: DimensionId;
  /** 天气 */
  weather: Weather;
  /** 生成位置 */
  posType: string;
  /** 已勾选的附近特殊方块特征 */
  features: string[];
  /** 脚下基底方块特征 */
  baseFeature: string;
  /** 天空可见性 */
  sky: SkyVisibility;
  /** 高度范围 */
  height: HeightRange;
  /** 天空暴露度 */
  skyExposure: SkyExposure;
  /** 环境亮度 */
  localLight: LocalLightRange;
  /** 月相 */
  moonPhase: MoonPhase;
  /** 是否在史莱姆区块 */
  slimeChunk: SlimeChunk;
  /** 所在结构，null 表示普通地形 */
  structure: string | null;
}

/** 场景设置使用的静态数据与派生选项。 */
export interface ScenarioSettingsOptions {
  /** 可选群系列表（仅保留生成池涉及的群系） */
  biomes: string[];
  /** 群系 id -> 所属标签列表（数据文件派生） */
  tagsByBiome: Record<string, string[]>;
  /** 当前群系解析出的、生成池用到的标签 */
  biomeTags: string[];
  /** 可选附近特征 id 列表（由生成池数据派生） */
  featureOptions: string[];
  /** 可选脚下基底特征 id 列表（由生成池数据派生，不含 natural） */
  baseFeatureOptions: string[];
  /** 可选结构列表（由生成池数据派生） */
  structureOptions: string[];
  /** 特征 id -> 具体方块/tag 列表（悬浮提示显示） */
  blockFeatures: Record<string, string[]>;
}

/** 场景设置组件参数。 */
interface ScenarioSettingsProps {
  /** 当前表单值 */
  value: ScenarioSettingsValue;
  /** 当前数据集可用的选项 */
  options: ScenarioSettingsOptions;
  /** 合并到当前表单值的局部更新 */
  onChange: (patch: Partial<ScenarioSettingsValue>) => void;
}

/**
 * 特征选项芯片：悬浮显示该特征包含的具体方块/tag 列表（无方块列表时不显示悬浮）。
 * 用于「附近特殊方块」与「脚下基底方块」两组多/单选。
 */
function FeatureToggle({ value, blocks }: { value: string; blocks: string[] }) {
  const { t } = useTranslation();
  const item = (
    <ToggleGroupItem value={value} variant="outline" size="sm" className="h-7 px-3">
      {t(`blockFeature.${value}`, { defaultValue: value })}
    </ToggleGroupItem>
  );
  if (blocks.length === 0) {
    return item;
  }
  return (
    <Tooltip>
      <TooltipTrigger render={<span />}>{item}</TooltipTrigger>
      <TooltipContent className="block max-w-72 space-y-1 font-mono text-xs">
        <span className="font-sans font-medium">{t("blockFeature.tooltip")}</span>
        <ul className="space-y-0.5 break-all">
          {blocks.map((block) => (
            <li key={block}>{block}</li>
          ))}
        </ul>
      </TooltipContent>
    </Tooltip>
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
  getLabel,
}: {
  /** 选项值列表 */
  values: readonly T[];
  /** i18n 键前缀（light / weather / position） */
  labelPrefix: string;
  /** 当前选中值 */
  selected: T;
  /** 选中变化回调 */
  onSelect: (value: T) => void;
  /** 自定义选项文案（优先于 labelPrefix 的 i18n 键，用于数值等语言无关文本） */
  getLabel?: (value: T) => string;
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
        <ToggleGroupItem
          key={value}
          value={value}
          variant="outline"
          size="sm"
          className="h-7 px-3"
        >
          {getLabel ? getLabel(value) : t(`${labelPrefix}.${value}`)}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

/** 结构选择：可搜索下拉（值含哨兵 "none" 表示普通地形，显示本地化标签） */
function StructureSelector({
  structureOptions,
  selected,
  onSelect,
}: {
  /** 可选结构列表（由生成池数据派生） */
  structureOptions: string[];
  /** 当前选中结构（null=普通地形） */
  selected: string | null;
  onSelect: (structure: string | null) => void;
}) {
  const { t } = useTranslation();
  const items = ["none", ...structureOptions];
  return (
    <Combobox
      items={items}
      value={selected ?? "none"}
      onValueChange={(value) => {
        if (value) {
          onSelect(value === "none" ? null : value);
        }
      }}
      filter={(item, query) => {
        const q = query.trim().toLowerCase();
        if (!q) {
          return true;
        }
        if (item === "none") {
          return t("structure.none").toLowerCase().includes(q);
        }
        return item.toLowerCase().includes(q);
      }}
    >
      <ComboboxInput placeholder={t("structure.placeholder")} className="w-full" />
      <ComboboxContent>
        <ComboboxEmpty>{t("structure.empty")}</ComboboxEmpty>
        <ComboboxList>
          {(item) => (
            <ComboboxItem key={item} value={item} className="truncate">
              {item === "none" ? t("structure.none") : item}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}

/** 场景设置内容组件（群系 / 光照 / 天气 / 生成位置 / 附近特殊方块） */
export function ScenarioSettings({ value, options, onChange }: ScenarioSettingsProps) {
  const { t } = useTranslation();
  const {
    biomeId,
    timeOfDay,
    dimension,
    weather,
    posType,
    features,
    baseFeature,
    sky,
    height,
    skyExposure,
    localLight,
    moonPhase,
    slimeChunk,
    structure,
  } = value;
  const {
    biomes,
    tagsByBiome,
    biomeTags,
    featureOptions,
    baseFeatureOptions,
    structureOptions,
    blockFeatures,
  } = options;

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="space-y-1.5">
        <Label>{t("scenario.biome")}</Label>
        <BiomeSelector
          biomes={biomes}
          selected={biomeId}
          onSelect={(nextBiomeId) => onChange({ biomeId: nextBiomeId })}
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

        <div className="space-y-1.5">
          <Label>{t("scenario.dimension")}</Label>
          <OptionGroup
            values={DIMENSION_VALUES}
            labelPrefix="dimension"
            selected={dimension}
            onSelect={(nextDimension) => onChange({ dimension: nextDimension })}
          />
        </div>

        <div className="space-y-1.5">
          <Label>{t("scenario.structure")}</Label>
          <StructureSelector
            structureOptions={structureOptions}
            selected={structure}
            onSelect={(nextStructure) => onChange({ structure: nextStructure })}
          />
        </div>

        <div className="space-y-1.5">
          <Label>{t("scenario.sky")}</Label>
          <OptionGroup
            values={SKY_VISIBILITY_VALUES}
            labelPrefix="sky"
            selected={sky}
            onSelect={(nextSky) => onChange({ sky: nextSky })}
          />
        </div>

        <div className="space-y-1.5">
          <Label>{t("scenario.height")}</Label>
          <p className="text-xs text-muted-foreground">{t("scenario.heightHint")}</p>
          <OptionGroup
            values={HEIGHT_RANGE_VALUES}
            labelPrefix="height"
            selected={height}
            onSelect={(nextHeight) => onChange({ height: nextHeight })}
          />
        </div>

        <div className="space-y-1.5">
          <Label>{t("scenario.position")}</Label>
          <OptionGroup
            values={POSITION_VALUES}
            labelPrefix="position"
            selected={posType}
            onSelect={(nextPosType) => onChange({ posType: nextPosType })}
          />
        </div>

        <div className="space-y-1.5">
          <Label>{t("scenario.slimeChunk")}</Label>
          <OptionGroup
            values={SLIME_CHUNK_VALUES}
            labelPrefix="slimeChunk"
            selected={slimeChunk}
            onSelect={(nextSlimeChunk) => onChange({ slimeChunk: nextSlimeChunk })}
          />
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>{t("scenario.features")}</Label>
          <p className="text-xs text-muted-foreground">{t("scenario.featuresHint")}</p>
          <ToggleGroup
            multiple
            value={features}
            onValueChange={(nextFeatures) => onChange({ features: nextFeatures })}
            className="flex-wrap gap-1"
          >
            {featureOptions.map((feature) => (
              <FeatureToggle
                key={feature}
                value={feature}
                blocks={blockFeatures[feature] ?? []}
              />
            ))}
          </ToggleGroup>
        </div>

        <div className="space-y-1.5">
          <Label>{t("scenario.baseFeatures")}</Label>
          <ToggleGroup
            value={[baseFeature]}
            onValueChange={(values) => {
              if (values.length > 0) {
                onChange({ baseFeature: values[0] });
              }
            }}
            className="flex-wrap gap-1"
          >
            <FeatureToggle value="natural" blocks={[]} />
            {baseFeatureOptions.map((feature) => (
              <FeatureToggle
                key={feature}
                value={feature}
                blocks={blockFeatures[feature] ?? []}
              />
            ))}
          </ToggleGroup>
        </div>

        <div className="space-y-1.5">
          <Label>{t("scenario.skyExposure")}</Label>
          <OptionGroup
            values={SKY_EXPOSURE_VALUES}
            labelPrefix="skyExposure"
            selected={skyExposure}
            onSelect={(nextSkyExposure) => onChange({ skyExposure: nextSkyExposure })}
          />
        </div>

        <div className="space-y-1.5">
          <Label>{t("scenario.localLight")}</Label>
          <OptionGroup
            values={LOCAL_LIGHT_VALUES}
            labelPrefix="localLight"
            selected={localLight}
            onSelect={(nextLocalLight) => onChange({ localLight: nextLocalLight })}
          />
        </div>

        <div className="space-y-1.5">
          <Label>{t("scenario.weather")}</Label>
          <OptionGroup
            values={WEATHER_VALUES}
            labelPrefix="weather"
            selected={weather}
            onSelect={(nextWeather) => onChange({ weather: nextWeather })}
          />
        </div>

        <div className="space-y-1.5">
          <Label>{t("scenario.timeOfDay")}</Label>
          <OptionGroup
            values={TIME_OF_DAY_VALUES}
            labelPrefix="timeOfDay"
            selected={timeOfDay}
            onSelect={(nextTimeOfDay) => onChange({ timeOfDay: nextTimeOfDay })}
          />
        </div>

        <div className="space-y-1.5">
          <Label>{t("scenario.moonPhase")}</Label>
          <OptionGroup
            values={MOON_PHASE_VALUES}
            labelPrefix="moonPhase"
            selected={moonPhase}
            onSelect={(nextMoonPhase) => onChange({ moonPhase: nextMoonPhase })}
          />
        </div>
      </div>
    </div>
  );
}
