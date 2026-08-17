/**
 * 计算器主组件：加载静态数据，维护材料与场景（群系 / 光照 / 天气 / 生成位置）
 * 状态，计算吸引效果与影响结果，并组装页面各区块。
 */
import { useEffect, useMemo, useState } from "react";
import { useTranslation, Trans } from "react-i18next";
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
import {
  computeImpact,
  resolveLure,
  type Scenario,
  type LightRange,
  type Weather,
} from "@/lib/calc";
import { loadAllTheMonsData } from "@/lib/loader";
import type { AllTheMonsData } from "@/lib/types";
import { type UiLabels, extLink } from "@/components/shared";
import { MaterialSelector } from "@/components/material-selector";
import { ScenarioSettings } from "@/components/scenario-settings";
import { LureSummary, hasLureEffects } from "@/components/lure-summary";
import { ImpactTable } from "@/components/impact-table";

/** 材料槽位上限（对应游戏内烹饪锅的调料槽数量） */
const MAX_MATERIALS = 3;

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
        <CardContent>
          <ScenarioSettings
            biomes={biomeOptions}
            biomeId={biomeId}
            onBiomeChange={setBiomeId}
            tagsByBiome={data.biomeTagReverse}
            biomeTags={resolvedBiomeTags}
            light={light}
            onLightChange={setLight}
            weather={weather}
            onWeatherChange={setWeather}
            posType={posType}
            onPosTypeChange={setPosType}
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
