/**
 * 计算器主组件：加载静态数据，维护材料与场景（群系 / 光照 / 天气 / 生成位置）
 * 状态，计算吸引效果与影响结果，并组装页面各区块。
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation, Trans } from "react-i18next";
import { RotateCcwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { normalizeLocale } from "@/lib/i18n";
import { computeImpact, resolveLure, type Scenario } from "@/lib/calc";
import { loadAllTheMonsData } from "@/lib/loader";
import type { AllTheMonsData } from "@/lib/types";
import { type UiLabels, extLink } from "@/components/shared";
import { MaterialSelector } from "@/components/material-selector";
import {
  ScenarioSettings,
  type ScenarioSettingsOptions,
  type ScenarioSettingsValue,
} from "@/components/scenario-settings";
import { LureSummary, hasLureEffects } from "@/components/lure-summary";
import { ImpactTable } from "@/components/impact-table";

/** 材料槽位上限（对应游戏内烹饪锅的调料槽数量） */
const MAX_MATERIALS = 3;

/** 场景设置 localStorage 持久化键 */
const SCENARIO_SETTINGS_STORAGE_KEY = "atmons-bait-calc:scenario-settings";

/** 场景设置表单默认值。 */
const DEFAULT_SCENARIO_SETTINGS: ScenarioSettingsValue = {
  biomeId: "minecraft:plains",
  timeOfDay: "day",
  dimension: "minecraft:overworld",
  weather: "clear",
  posType: "grounded",
  features: [],
  baseFeature: "natural",
  sky: "open",
  height: "high",
  skyExposure: "open",
  localLight: "bright",
  moonPhase: "any",
  slimeChunk: "no",
  structure: null,
};

/**
 * 从 localStorage 读取场景设置并与默认值合并：
 * - 缺失 / 多余字段回退默认值，容忍旧版本持久化数据结构变化
 * - 解析失败（损坏 JSON / localStorage 不可用）时回退默认值
 */
function loadScenarioSettings(): ScenarioSettingsValue {
  try {
    const raw = localStorage.getItem(SCENARIO_SETTINGS_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_SCENARIO_SETTINGS;
    }
    const parsed = JSON.parse(raw) as Partial<ScenarioSettingsValue>;
    return {
      ...DEFAULT_SCENARIO_SETTINGS,
      ...parsed,
      features: Array.isArray(parsed.features) ? parsed.features : [],
    };
  } catch {
    return DEFAULT_SCENARIO_SETTINGS;
  }
}

export default function Calculator() {
  const { t, i18n } = useTranslation();
  const locale = normalizeLocale(i18n.language);

  const [data, setData] = useState<AllTheMonsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [scenarioSettings, setScenarioSettings] =
    useState<ScenarioSettingsValue>(loadScenarioSettings);

  const [reloadKey, setReloadKey] = useState(0);

  /** 将局部场景表单更新合并到当前值。 */
  const updateScenarioSettings = useCallback((patch: Partial<ScenarioSettingsValue>) => {
    setScenarioSettings((current) => ({ ...current, ...patch }));
  }, []);

  /** 重置场景设置为默认值 */
  const resetScenarioSettings = useCallback(() => {
    setScenarioSettings(DEFAULT_SCENARIO_SETTINGS);
  }, []);

  // 场景设置变化时持久化到 localStorage
  useEffect(() => {
    try {
      localStorage.setItem(
        SCENARIO_SETTINGS_STORAGE_KEY,
        JSON.stringify(scenarioSettings),
      );
    } catch {
      // 序列化 / 写入失败时忽略，仅影响下次进入的恢复
    }
  }, [scenarioSettings]);

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
      for (const anti of entry.antiConditions ?? []) {
        for (const b of anti.biomes) {
          set.add(b);
        }
      }
    }
    return set;
  }, [data]);

  const resolvedBiomeTags = useMemo(() => {
    if (!data) {
      return [];
    }
    return (data.biomeTagReverse[scenarioSettings.biomeId] ?? []).filter((tag) =>
      poolTagSet.has(tag),
    );
  }, [data, poolTagSet, scenarioSettings.biomeId]);

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
    () => ({
      biomeTags: resolvedBiomeTags,
      timeOfDay: scenarioSettings.timeOfDay,
      dimension: scenarioSettings.dimension,
      weather: scenarioSettings.weather,
      posTypes: [scenarioSettings.posType],
      features: scenarioSettings.features,
      baseFeatures: [scenarioSettings.baseFeature],
      sky: scenarioSettings.sky,
      height: scenarioSettings.height,
      skyExposure: scenarioSettings.skyExposure,
      localLight: scenarioSettings.localLight,
      moonPhase: scenarioSettings.moonPhase,
      slimeChunk: scenarioSettings.slimeChunk,
      structure: scenarioSettings.structure,
    }),
    [resolvedBiomeTags, scenarioSettings],
  );

  /** 生成池中出现过的特征 id 列表（供场景设置勾选：附近一组、脚下基底一组） */
  const featureOptions = useMemo(() => {
    const nearby = new Set<string>();
    const base = new Set<string>();
    if (data) {
      for (const entry of data.spawnPool) {
        for (const f of entry.requiredNearby ?? []) {
          nearby.add(f);
        }
        for (const anti of entry.antiConditions ?? []) {
          for (const f of anti.requiredNearby ?? []) {
            nearby.add(f);
          }
        }
        for (const f of entry.requiredBase ?? []) {
          base.add(f);
        }
        for (const anti of entry.antiConditions ?? []) {
          for (const f of anti.requiredBase ?? []) {
            base.add(f);
          }
        }
      }
    }
    return {
      nearbyOptions: [...nearby],
      baseOptions: [...base].filter((feature) => feature !== "natural"),
    };
  }, [data]);

  /** 生成池中出现过的结构 id/tag 列表（供「所在结构」单选） */
  const structureOptions = useMemo(() => {
    const set = new Set<string>();
    if (data) {
      for (const entry of data.spawnPool) {
        for (const s of entry.structures ?? []) {
          set.add(s);
        }
        for (const anti of entry.antiConditions ?? []) {
          for (const s of anti.structures ?? []) {
            set.add(s);
          }
        }
      }
    }
    return [...set];
  }, [data]);

  /** 场景组件使用的数据选项，集中传递以保持组件接口稳定。 */
  const scenarioSettingOptions: ScenarioSettingsOptions = useMemo(
    () => ({
      biomes: biomeOptions,
      tagsByBiome: data?.biomeTagReverse ?? {},
      biomeTags: resolvedBiomeTags,
      featureOptions: featureOptions.nearbyOptions,
      baseFeatureOptions: featureOptions.baseOptions,
      structureOptions,
      blockFeatures: data?.blockFeatures ?? {},
    }),
    [biomeOptions, data, featureOptions, resolvedBiomeTags, structureOptions],
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
      <div className="flex h-20 items-center justify-center gap-2 text-sm text-muted-foreground">
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
              "All the Mons",
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
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-1.5">
              <CardTitle>{t("scenario.title")}</CardTitle>
              <CardDescription>{t("scenario.description")}</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-7 shrink-0 gap-1.5 px-3"
              onClick={resetScenarioSettings}
            >
              <RotateCcwIcon className="size-3.5" />
              {t("scenario.reset")}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ScenarioSettings
            value={scenarioSettings}
            options={scenarioSettingOptions}
            onChange={updateScenarioSettings}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("lure.title")}</CardTitle>
          <CardDescription>
            {hasLureEffects(lure) ? t("lure.description") : t("lure.empty")}
          </CardDescription>
        </CardHeader>
        {hasLureEffects(lure) && (
          <CardContent>
            <LureSummary lure={lure} labels={labels} />
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardDescription>
            {t("table.summary", {
              total: impact.summary.totalSpecies,
              note: selected.length === 0 ? t("table.summaryBaseNote") : "",
              up: impact.summary.boosted,
              down: impact.summary.reduced,
              blocked: impact.summary.blocked,
            })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ImpactTable impact={impact} labels={labels} namesById={namesById} />
        </CardContent>
      </Card>

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
