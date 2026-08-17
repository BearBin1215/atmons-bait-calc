## 项目概述

All the Mons 宝点心概率计算器，部署于 GitHub Pages（BearBin1215/atmons-bait-calc）。

## 技术栈

- **构建**: Vite 8
- **框架**: React 19
- **UI组件库**: shadcn/ui
- **图标库**：lucide-react, @icons-pack/react-simple-icons
- **样式**: Tailwind CSS v4
- **i18n**: i18next + react-i18next
- **语言**: TypeScript
- **包管理**: pnpm
- **代码规范**: oxlint + oxfmt

## 对话

- 如果用户提出的需求或设计较为笼统，有多个方案可以使用，**列出方案让用户选择**

## 数据来源

- 静态数据运行 `pnpm extract:all-the-mons` 生成，由 `scripts/extract-all-the-mons.ts` 从本地 Cobblemon 仓库抓取生成到 `public/data/`（7 个 JSON，为 Cobblemon 基础数据 + All the Mons 覆盖数据的合并快照）
- 数据来源工作区根目录默认为 `../cobblemon`（相对本工程，其下包含 `cobblemon` 模组源码仓库与 `All-the-Mons` 整合包仓库），可通过环境变量 `COBBLEMON_ROOT` 覆盖；数据 / 语言 / 版本文件路径均由该根目录派生
- 数据格式为多语言：`species.json` / `materials.json` 使用 `names: { zh, en }`；`labels.json` 使用 `types / stats / eggGroups: { zh, en }`
- 树果物品图标（`public/icons/berries/<物品id>.png`）为静态资源，来源为 Cobblemon 仓库
- 非树果物品图标（`public/icons/items/<物品id>.<png|gif>`，原版物品为主）为静态资源，来源为 Minecraft Wiki、AllTheMods/AllTheModium 仓库等来源，新增时需在 `calculator.tsx` 的 `ITEM_ICON_EXTS` 中登记，默认扩展名 png，其余如 gif 需注明

## 多语言

- 支持 zh / en，基于 i18next + react-i18next（`lib/i18n.ts` 初始化字典），语言切换后持久化到 localStorage，默认 zh
- 翻译分层：
  - 静态 UI 文案 -> `lib/i18n.ts` 字典，用 `t(key)` 或 `t(key, params)` 获取（`{{name}}` 占位符插值）
  - 句子内嵌 React 元素（如链接）-> react-i18next 的 `Trans` 组件，翻译串内用 `<name>...</name>` 占位，语序由翻译串完全控制
  - 数据内名称（宝可梦、材料、属性、能力值、蛋群）-> 从数据文件按当前 locale 解析，zh 缺失回退 en
- 新增语言只需两处：`i18n.ts` 加键值、`LOCALE_LABELS` 加显示名
- `lib/labels.ts` 只放语言无关内容（颜色、排序、选项值列表），禁止添加翻译文本
- 新引入的可见文案必须走 i18n（`t()` / `Trans`）或数据多语言字段，禁止硬编码单语言

## 与旧工程的同步约定

- 本工程与 BearBin1215.github.io 共享数据抓取脚本与数据层：
  - `scripts/extract-all-the-mons.ts` 两工程核心逻辑一致
  - `src/lib/` 下的 `types.ts`、`loader.ts`、`calc.ts` 与旧工程 `src/pages/toys/all-the-mons/` 对应文件保持一致
  - `public/data/` 数据由同一脚本生成
- 修改脚本或数据格式时，需同步更新旧工程并运行其测试（旧工程测试位于 `test/`，命令 `pnpm test:run`）

## 常用指令

```bash
# 启动开发服务器
pnpm dev

# 类型检查
pnpm typecheck

# 代码规范检查 / 自动修复
pnpm lint
pnpm lint:fix

# 格式化
pnpm format

# 生产构建
pnpm build

# 重新抓取生成数据（依赖本地 ../cobblemon 仓库）
pnpm extract:all-the-mons

# 添加 shadcn/ui 组件
pnpm dlx shadcn@latest add 组件名
```

## 项目结构

仅展示大致结构，`<占位符>` 与 `*` 表示对应位置是动态值或同类文件：

```text
src/
├── components/
│   ├── calculator.tsx     # 计算器主组件（数据加载、状态维护、Card 外壳与页面组装）
│   ├── shared.tsx         # 各区块共享的 UiLabels、格式化工具、分类标签解析
│   ├── material-selector.tsx  # 材料选择面板（含材料图标解析 ITEM_ICON_EXTS / materialIconUrl）
│   ├── scenario-settings.tsx  # 场景设置内容（群系 / 光照 / 天气 / 生成位置）
│   ├── lure-summary.tsx   # 吸引效果摘要内容
│   ├── impact-table.tsx   # 影响结果表格内容（筛选、排序、物种明细）
│   └── ui/                # shadcn/ui 组件（badge、button、card、dropdown-menu、empty、input、label、spinner、table、tooltip）
├── lib/
│   ├── calc.ts            # 概率计算核心（复刻 Cobblemon 源码机制）
│   ├── types.ts           # 数据与计算结果类型定义
│   ├── loader.ts          # 静态数据懒加载与缓存
│   ├── labels.ts          # 语言无关的展示辅助（颜色、排序、选项值列表）
│   ├── i18n.ts            # 静态 UI 文案翻译字典（zh/en，i18next）
│   └── utils.ts           # cn 等通用工具函数
├── App.tsx                # 页顶 Header（标题+图标 / 语言切换 / GitHub 链接）+ 主体
├── main.tsx
└── index.css              # Tailwind v4 入口（仅浅色模式）
public/
├── data/                 # 抓取生成的数据（bait-effects、materials、species、spawn-pool、biome-tags-reverse、labels、meta）
├── icons/berries/        # 树果物品图标（手动添加，见「数据来源」）
├── icons/items/          # 非树果物品图标（手动添加，见「数据来源」）
├── poke_snack.png        # 站点图标（来自 Cobblemon 模组，MPL-2.0 许可）
└── ICON_LICENSE.txt      # 图标许可声明
scripts/
└── extract-all-the-mons.ts  # 数据抓取脚本（与旧工程完全一致）
.github/workflows/deploy.yml # push main 自动构建部署到 GitHub Pages
```

## 代码规范

### TypeScript

- 多次使用的变量、通用组件、工具函数都应有对应的jsdoc注释，复杂逻辑需要描述逻辑
- 接口定义的每个属性都要有对应jsdoc注释，除非是 id/key 等唯一标识符等一眼能看出含义的属性
- 代码修改后，不要注释说明这里曾经是什么样，只说明最新代码（除非要提醒开发者不要使用废弃方案）
- 每次涉及ts的代码修改后运行 `pnpm typecheck`、`pnpm lint`、`pnpm format` 检查类型和规范错误
