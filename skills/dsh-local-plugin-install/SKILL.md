---
name: dsh-local-plugin-install
description: 把本地插件安全装进 DSH：先审再装（CLI/UI 都能登记，手改是兑底）＋复验。触发：装本地插件、列表不出现、审计第三方包。
---

> **这是脱敏公开版**；本机在用的那份在技能目录（更长、带内部附录），**两份别混**。
> **公开版说明**：本文所有路径都是**占位符**（如 `<DSH 安装目录>`、`<DSH_HOME>\profiles\<profile>`、`<技能目录>`），照做时换成你自己机器的对应位置；流程与判据与机器无关。**产品实名（DeepSeek Harness / DSH / `@deepseek-ai/*`）保留**——这份就是给 DSH 用户写的，不隐去。

> ### 本包不含、需自备（照抄会撞「路径不存在」的四件事）
>
> | 缺的东西 | 被本文哪里引用 | 后果 |
> |---|---|---|
> | 技能 `dsh-plugin-localization`（`scripts\dsh_plugin_title.mjs` + `assets\titles.json`） | §3.5 汉化、§收口 | 那两步跑不起来，只能自己照 §3.5 的**四条判据**手工做 |
> | 你自己的 AGENTS 卡（引用了它 §0.7） | §5 排查表末行 | 那个编号在本文里不存在，按「易被冲刷的补丁」自己理解 |
> | 仓里的 `install-receipts/` 目录 | §3.6 三个落点之一 | **落点只是作者的写法**：回单落在**你自己的仓/目录**即可 —— 回单这一步是**正路**（装完要能复盘），不是可选 |
> | 备份区 `profile-@deepseek-ai-清理-*` 与 `00_目录导引.md` | §3 末「profile 已经被跑坏了」 | 那是作者本机的救命材料，你只能从**你自己的**备份里拷 |
>
> **读法**：对外能独立跑通的是 §0.0 审计 → §2 合格条件 → §3 三步登记 → §3.6 回单（落点你自己的目录）→ §4 验证顺序 → §5 排查表。§3.5 汉化与「profile 被跑坏了」那段引用作者本机材料，**当参考看**。

# 装本地源码插件（DSH）

## 0.0 先审计：市场能装，但插件不一定能装（2026-10-22 立，因实战炸机）

> **来历**：从 dshmarket 直装 `dsh-auto-review` 把 DSH 装到**起不来**，且没有任何日志说明改了什么。
> 真因（插件 CHANGELOG 0.13.8 / issue #74）：包把 **14 个 `@deepseek-ai/dsh-*` 宿主实现包**
> 写成 runtime `dependencies`，pnpm 装到 profile 根后**顶掉宿主的 provider** →
> `credentials`/`fs`/`subprocess`/`sandbox`/`sandboxPolicy`/`sessionPersistence`/`connection`
> 全部无法激活 → 应用无法启动。市场给的是 ≤0.13.7，**它不会提示版本选错了**。

装任何第三方包之前，先跑同目录的 `audit-plugin-package.cjs`（只读，不改任何东西）：

> **市场的插件没有"只下载"这个选项**——页面上就是直接装。所以想先审，只有两条路：
> ① 源码包（GitHub / 本地目录）：先下到本地，审那个目录；
> ② 市场页上的包：**绕过市场自己从 registry 取 `.tgz`** 审完再装（本脚本吃 `.tgz`）。

```powershell
& '<DSH 安装目录>\resources\runtime\primary-runtime\dependencies\node\bin\node.exe' `
  '<技能目录>\dsh-local-plugin-install\audit-plugin-package.cjs' <包目录或 .tgz>
```

退出码：`0` 可装 / `1` 有条件（看 WARN）/ `2` 拒绍（BLOCKER）。
最重要的一条是「`dependencies` 里有 `@deepseek-ai/*`」——**那就是能把 DSH 装到起不来的那种包。**

审计通过后，再按下面 §1–§3 做本地登记。

## 0. 一句话

**本地插件不用"安装"，只需要"登记"。** 文件已经在你硬盘上了，缺的是让宿主知道"有这么个东西、要加载它"。

## 1. 装插件是两件事（2026-11-02 复测修正本节旧结论）



| 步骤 | 做什么 | 本地目录可行吗 |

|---|---|---|

| ① 装文件 | `pnpm add <来源>`（npm / tarball / `file:` 本地目录都可以） | ✅ pnpm 三种都支持 |

| ② 登记 | 包名写进 profile `package.json` 的 `dsh.profile.bundles` | ✅ **CLI 与 UI 都会写**（但必须复验，见下） |



**正路（2026-11-02 复测 + 源码实证）**



- **CLI**：`dsh plugin --profile <名字> add file:<本地目录>` —— 实测 `dependencies` 与 `dsh.profile.bundles` **两处都写**。

- **UI**：「设置 → 插件 → 添加插件」输入框直接吃**本地目录绝对路径**（`<盘符>:/path/to/plugin` 或带 `file:` 前缀都行）。

  源码实证：`dsh-plugin-manager/lib/index.js` 的 `parseInstallSpec` 把输入分五类——registry / **path（本地目录）** / tarball / git / 拒收相对路径；

  同一文件里有 `bundles.push(name)` + `saveManifest`——**UI 自己就写登记，登记不用手改**。

  它「看起来只能走网络」是两处视觉误导：示例占位符是包名 + 「安装源 / npm 镜像地址」下拉——那个只对包名生效，本地路径不经过它。

- **跑完必须复验**：重读 `package.json`，确认两处都写了；没写全再回 §3 手改登记（兑底）。



**旧断言作废**：本节早前写「`dsh plugin add` 只转发 pnpm、**不写 bundles** → 装了等于没装」「登记 ❌ **没有 UI，也没有 CLI**」——

**两条都错**：CLI 那半在 2026-11-02 上午的隔离复测里被推翻，UI 那半在 2026-11-02 的源码实证里被推翻。

**当年误判的来源**（推断，未复现）：在**炸坏的 profile** 上试——活 profile 是 hoisted 平铺布局 + 残缺 lock，

add 触发的 pnpm 在它上面失败或半途而废，观察到的是「跑了没写进去」，被记成了「CLI 不做登记」。



dshmarket 认识 `file:` 依赖这点仍然成立：给「本地开发」角标，路径失效时报"安装来源是另一台电脑上的本地路径"。



## 1.5 开发态：`--patch` 直指源码，不用装（2026-11-02 实测）



写插件调试期不必登记、不必复制进 node_modules——patch 的 `name` 直接写 **`.js` 文件绝对路径**：



```yaml

# dev/cordis.yml（正斜杠绝对路径）

- insert:

    - id: dev

      name: '<盘符>:/path/to/my-plugin.js'

```



```powershell

# 官方 CLI 包装（<DSH 安装目录>\resources\runtime\cli\bin\dsh.cmd）或直接指 asar 里的 cli.js

& '<DSH 安装目录>\resources\runtime\cli\bin\dsh.cmd' --profile web --patch '<盘符>:/path/to/dev/cordis.yml'

```



实测：`--dump-config` 组合树里那个 `name` 是以 `file:` 开头的绝对路径 URL（如 `file:` + 本地插件的 .js 绝对路径），

且 profile 的 `package.json` **一字未动**（不落 dependencies、不落 bundles，不碰 node_modules）；`--patch` 可重复给，叠在 profile 层之后。



**定位：开发调试用。** 正式插件仍走 §2 合格目录 + §3 登记——`--patch` 下次不带参数启动就没了，

也没有市场角标 / locale 汉化 / 浏览器半边打包。

## 2. 前置：插件目录必须合格

缺一条就白装：

```jsonc
// package.json
{
  "name": "dsh-xxx",                     // 必须与 bundles 里写的名字一致
  "type": "module",
  "main": "index.js",                    // 或 exports["."]
  "exports": {
    ".": "./index.js",
    "./client": "./client.js",           // 有浏览器半边才需要
    "./locale/*.json": "./locale/*.json" // 有中文名才需要
  },
  "files": ["index.js", "client.js", "cordis.patch.yml", "locale"],
  "dsh": { "bundle": { "patch": "./cordis.patch.yml" } }   // ← 缺这个必报 not-bundle
}
```

```
插件目录/
  cordis.patch.yml     ← 内容：- insert: [{ id: dsh-xxx, name: dsh-xxx }]
  index.js             ← 宿主半边
  client.js            ← 浏览器半边（可选）
  locale/zh.json       ← 中文显示名（可选，但结构必须对！）
```

**locale 的结构必须带 `meta` 包裹**（2026-10-22 实测踩坑，见 §5.1）：
```jsonc
{ "meta": { "title": "插件显示名", "description": "一句话说明" } }
```
写成 `{"name": ..., "description": ...}` 的话，**插件在「设置 → 插件」列表里完全不出现，
且没有任何报错**——这是最难查的一个坑。

**目录路径不能含中文**：pnpm 会以 GBK 回写成乱码。

## 3. 登记：CLI/UI 装（自动写登记）＋复验；手改是兑底（幂等，可重复执行）

> **效果展示**：本包是命令行技能，无界面、无配图——它的效果就是终端里那份审计输出与登记后的 package.json。
> **这是兑底路径**：正常装法是 §1 的 CLI / UI（它们会写登记），**只有这两处没写全时才手改下面这两处**。
> 手改不是野路子，但它不是第一选择。

改 `<DSH_HOME>\profiles\<profile>\package.json` 两处 + 复制目录：

```jsonc
{
  "dependencies": {
    "dsh-xxx": "file:<插件源码目录>/dsh-xxx"      // ① 依赖，指向源码目录
  },
  "dsh": {
    "profile": {
      "bundles": [
        "...",
        "dsh-xxx"                                  // ② 登记：决定是否被加载
      ]
    }
  }
}
```

```powershell
# ③ 把包放进 profile 的 node_modules（file: 依赖其实是实体拷贝，不是软链）
Copy-Item '<插件源码目录>\dsh-xxx' '<DSH_HOME>\profiles\<profile>\node_modules\dsh-xxx' -Recurse -Force
```

然后**刷 pnpm 时间戳**（不刷 pnpm 可能认不出要重装）：

```powershell
$prof='<DSH_HOME>\profiles\<profile>'; $now=Get-Date
(Get-Item "$prof\node_modules\.modules.yaml").LastWriteTime = $now
(Get-Item "$prof\pnpm-lock.yaml").LastWriteTime = $now.AddSeconds(-30)
(Get-Item "$prof\node_modules\.pnpm\lock.yaml").LastWriteTime = $now.AddSeconds(-30)
```

**最后必须完全重启 DSH**（profile 改动只在启动时读）。

### 3.5 汉化：登记完立刻做（2026-10-28 立 · 触发点就在这一步）

> **为什么单独立这一节**：2026-10-28 在鲸鱼娘区装 `dsh-session-shift`，安装报告里有「汉化」这一节，
> 但做出来的是**纯中文名**（`"title": "会话交接"`）、**没有 en.json**、**没有 `包名（中文名）` 格式**，
> 报告里也没出现 §收口 那行输出槽位。根因不是"忘了"，是**触发点设错**（旧触发要求"在设置列表里出现"，
> 那要完全重启 + 人点开界面才观察得到，装插件的会话根本等不到）。

**触发 = 上面四步做完的那一刻**（`node_modules` 实体就位、时间戳已刷）。
**不是**"等它出现在「设置 → 插件」列表里"。

**做法**：把 `<包名>: "<中文名>"` 加进 `assets\titles.json`，跑一次汉化脚本
（zh/en 一起写、exports/files 接线、源码目录同步、自检，全自动）：

```powershell
$env:ELECTRON_RUN_AS_NODE='1'
& '<DSH 安装目录>\DeepSeek Harness.exe' '<技能目录>\dsh-plugin-localization\scripts\dsh_plugin_title.mjs' `
  --map '<技能目录>\dsh-plugin-localization\assets\titles.json'
```

**四条判据（重启前就能全验完，不依赖界面）**：
① `locale/zh.json` 与 `locale/en.json` 都在；
② 两份都 `JSON.parse` 得过且 `meta.title` 非空；
③ `zh.meta.title` = `<包名>（<中文名>）`，**全角括号** —— 纯中文名不合格（主人要「原名 + 中文」）；
④ `package.json` 的 `exports` 有 `"./locale/*.json"`、`files` 有 `"locale"`。

**重启后**再补一条复核：列表里看得见中文名 —— 这条只证明"被解析"，不算触发条件。

### 3.6 交回单：落盘才算完（2026-10-28 立 · 落点含开源脱敏版）

**触发**：§3 登记 + §3.5 汉化做完。

**动作**：按模板 `<你的模板目录>\install-receipt-template.md` 写回单，三个落点各司其职：

| 落点 | 内容 | 性质 |
|---|---|---|
| `<工作区>\.dsh\install\<包名>-<YYYYMMDD-HHmm>.md` | **原件**：真实路径、审计原文、回滚命令 | 私有 |
| `<工作区>\.dsh\install\latest.md` | 一行指针：相对路径 + 生成时间 | 私有 |
| `<你的公开仓>\install-receipts\<包名>.md` | **脱敏版**：路径收敛到盘符级、去掉工作区名与账号名 | 公开 |

**公开版的三个状态**：`public: staged`（已落仓工作区、未提交）/ `public: pushed`（已提交且已推送）/
`public: pending`（仓不可用，先落 `<你的内部存档>\install-receipts\`）。
**提交与推送不归安装流程**（执行细则：由主人统一推）；回单只记 `staged`，主人推完改 `pushed`。
落盘前先跑 `git -C <仓> status -sb`：工作区有别人的未提交改动时先提醒主人再落 —— **公开的是 GitHub 上那份，不是工作区那份**（D1）。
**不许**把未脱敏内容放进公开仓（D2）。

**判据**：六节齐全（环境时间线 / 审计原文+退出码 / 登记五步 / 汉化四条判据 / 验证证据 / 回滚）；
`latest.md` 指向的文件存在；验证段没有拿 `/api/*` 当证据；公开版的路径不含盘符级具体目录名。

**出口**：拿不到审计原文 → 贴命令 + 退出码；插件没客户端半边 → 验证段写「无界面项，看 `.active` 标记」；
`package.json` 改坏 → `status: broken` + 说明回滚是否已执行。

**不许**：只在聊天里说「装好了」；回单留空字段；手写 `locale/*.json` 冒充汉化完成。

### ⚠️ 绝对不要在 profile 目录手动跑 `pnpm install`（2026-10-21 炸过一次）

**症状**：跑完之后 DSH 起不来，报 `Cannot find package`，或者「1 required plugin did not activate」。

**原因**：本机 profile 的 `pnpm-lock.yaml` 是**残缺**的（只覆盖部分包、没有完整 packages 段），
而 `pnpm-workspace.yaml` 里是 `nodeLinker: hoisted`（扁平真实目录）。
pnpm 按这份残缺 lock 做 hoisted 清理时，会**把不在 lock 里的包物理删除** ——
2026-10-21 那次，profile 的 `@deepseek-ai` 包从 **306 个被删到只剩 36 个**
（`cordis`、`dsh-subprocess`、`dsh-skill`、`dsh-base`、`dsh-web-app` 等核心层全没了）。

**正确做法**：**只改 `package.json` + 手动复制目录 + 刷时间戳**（上面三步），
**不要让 pnpm 去动 profile**。插件市场自己跑 pnpm 时是安全的（它会先修 lock），
**手动跑就不一定**。

**如果 profile 已经被跑坏了**（核心包缺失）：从 `<备份区>\profile-@deepseek-ai-清理-*`
把缺的包拷回去，**但注意**：拷回去后 profile 里会有宿主包副本 → 同一个库加载两份 →
「设置 → 插件」启停插件会报 `profile reload requires the root Include entry`。
**根治是清理副本**，见 `<备份区>\00_目录导引.md` 第 ① 条。

## 4. 验证顺序（按这个顺序，不然会瞎猜）

1. `package.json` 能被 `JSON.parse` 解析（改坏了启动会直接出事）
2. `dependencies` 里有它、`dsh.profile.bundles` 里有它（**CLI/UI 装完必看这两处**；没写全走 §3 兑底）
3. `node_modules/<包名>/` 存在，且 `index.js` 在
4. 重启后：插件列表里出现；或看插件自己写的激活标记（如 `<DSH_HOME>\<插件名>.active`）
5. 有客户端半边的，刷新页面（部分需要重启）

## 5. 排查表

| 现象 | 原因 | 处理 |
|---|---|---|
| 装完没反应 | 没写 `dsh.profile.bundles` | 补上，重启 |
| **`设置 → 插件` 里根本看不到这个插件**（登记都对、实体也在、重启过了） | **`locale/zh.json` 结构错了**：DSH 读 `meta.title` 取显示名 | **见 §5.1，这是最坑的一个** |
| `error: not-bundle` | 缺 `dsh.bundle.patch` 声明 | 补 §2 那两处 |
| 插件列表里有但没功能 | 缺 `files` 里的文件没被带上 | 复制整个目录，别只挑文件 |
| 改了源码不生效 | 界面读的是 `node_modules` 的拷贝 | 改完两边同步 |
| 路径报乱码 / 装不上 | 路径含中文 | 挪到纯英文路径 |
| 重启后又被覆盖 | 官方会重新物化 `@deepseek-ai/*` | 那属于「易被冲刷的补丁」，见 AGENTS §0.7，配状态检查插件 |

### 5.1 最大的坑：locale 文件的 `meta` 包裹

**症状**：登记全对（`dependencies` 有、`bundles` 有、`node_modules` 实体在、语法没问题、
`import` 成功、`apply` 是函数、slot 注册写法跟能跑的兄弟插件一模一样），
**但插件在「设置 → 插件」列表里就是不出现**。**全程没有任何报错**，
`cordis.patch.yml` 里的条目也是好的，插件管理器的「来源信息」里连它都没有。

**原因**：DSH 从 `package.json` 的 `exports["./locale/*.json"]` 读 locale，
**显示名取自 `meta.title`**。写成 `{"name": ..., "description": ...}` 时
`meta` 是 `undefined` → 标题为空 → **插件管理器把这一项过滤掉了**。

**正确形态**（全机所有插件都是这个结构，`dsh-client-locale` 的 `client.js` 里有
`schema.meta ||= {}`，说明 `meta` 是必需字段）：

```jsonc
{
  "meta": {
    "title": "示例插件（中文名）",     // ← 显示名，插件列表里显示的就是它
    "description": "一句话说明这个插件干什么"
  }
}
```

**怎么自查**（一条命令，比逐个排查快得多）：

```powershell
$prof = '<DSH_HOME>\profiles\<profile>'
Get-ChildItem "$prof\node_modules" -Directory | ForEach-Object {
  $z = Join-Path $_.FullName 'locale\zh.json'
  if (Test-Path $z) {
    $o = Get-Content $z -Raw | ConvertFrom-Json
    if ($null -eq $o.meta) { '缺 meta: ' + $_.Name }   # ← 这些插件会不出现在列表里
  }
}
```

**教训**：`exports["./locale/*.json"]` 写对了、`files` 里有 `locale` 目录、
文件也真的拷过去了——**这些都不能证明 locale 会被正确解析**。
唯一可靠的判据是 `meta.title` 能被读出来。
**写插件时直接拄一个能跑的兄弟插件的 locale 文件，别凭直觉设计结构。**

### 5.2 附：`.active` 激活标记（判断「宿主半边有没有跑起来」）

插件可以在自己的 `apply()` 里往 `DSH_HOME` 写一个激活标记文件：

```js
try {
  writeFileSync(join(dshHome(), '<插件名>.active'), new Date().toISOString(), 'utf8')
} catch { /* 写不了不影响主功能 */ }
```

**用法**：卡片看不见、或怀疑宿主半边没加载时，看这个文件在不在
（`<DSH_HOME>\<插件名>.active`）——**比翻日志快**，因为 DSH 的运行日志
在 `%APPDATA%\@deepseek-ai\dsh-desktop\logs\` 里**只有崩溃转储，没有运行日志**。

**注意**：`.active` 是**插件自己写的**，不是 DSH 写的。没写这个文件的插件
（比如某个自写的守卫类插件）**没有标记 ≠ 没加载**，别据此下结论。

### 5.3 附：本机 profile 的 node_modules 是「平铺拷贝」，不是 pnpm 布局

实测（2026-10-22）：`<DSH_HOME>\profiles\<profile>\node_modules\.pnpm` **是空的**，
`node_modules` 下全是普通目录（`LinkType` 为空），`pnpm-lock.yaml` 与
`.modules.yaml` 里**查不到本机的 file: 插件**。

**所以这些 pnpm 判据在此环境全部不适用**：
「lockfile 里有没有这个包」「`.modules.yaml` 有没有登记」「`.pnpm` 里有没有它」
——**都不能用来判断插件是否被 DSH 加载**。真正要看的是
`package.json` 的 `dsh.profile.bundles` + `node_modules` 实体 + locale 的 `meta.title`。


## 6. 什么时候该做、什么时候别做

- **该做**：插件是自己的、市场没有、需要长期用。
- **别做**：能走 dshmarket 就走市场（它自动做①②④，还能检查更新）——**但先审这个插件**（§0.0）；市场装不出来的才手改登记。
- **别做的事**：为"装本地插件"写自动化脚本 / 开机自动跑。频率极低（一年几次），
  自动化反而会在启动时改写 profile、把手工改动打回去。**一次性手工 + 技能文档足矣。**

---

## 收口 · 装完必做：随手汉化（有触发、有输出槽位）

> 2026-10-26 立。**为什么单独立一节**：汉化这件事以前只写在技能 `dsh-plugin-localization` 里，
> 它是「什么时候想起来就去做」的被动条目 —— 结果就是装完一堆插件、列表里全是英文，
> 下次还得回头补。**触发条件解决「该不该发生」，输出槽位解决「发不发生」，缺一个就归零**（同 S1c）。

### 触发（什么时候必须做）

**登记完（§3 三步 + 刷时间戳）的那一刻就做 —— 见 §3.5。** 不等完全重启、不等「出现在设置列表里」、
不等主人说「这个名字看不懂」；同一次任务里做完，不留到下一个会话。

> **2026-10-28 修正**：旧触发写的是"插件一装进 profile 并在「设置 → 插件」里出现"。
> 那个事件要**完全重启 + 人点开设置界面**才成立，装插件的会话观察不到 → 条件永不成立、收尾永不执行
> （实测：鲸鱼娘区装 `dsh-session-shift`，只留了纯中文名、没 en.json、没槽位行）。
> 现在"出现在列表里"降级为**重启后的复核**，不再是触发条件。

### 输出槽位（做完必须写出来的那一行）

安装完成的汇报里，**必须出现这一行**（原样，不写就是没做完）：

```
插件显示名：<dsh-xxx> → <中文名>（locale/zh.json 已就位，meta.title 读得出来 ✅）
```

三个判据缺一不可：**① 文件在**（`locale/zh.json` 与 `locale/en.json`）、
**② 接上了**（`package.json` 的 `exports["./locale/*.json"]` 与 `files` 里有 `locale`）、
**③ 真的被解析**（`meta.title` 读得出来 —— 这只有刷新列表看到中文名才算数，写对导出不算）。

### 只有这两种情况可以跳过

1. 这个插件**本来就是中文/自带 locale**（先看 `locale/zh.json` 是否存在，别凭猜）；
2. 主人明确说「这个名字不用改」。

跳过也要在汇报里写一句 `插件显示名：<dsh-xxx> 跳过（原因：…）` —— **槽位不能整块消失**。

> 具体怎么做（文件结构、`meta.title` 缺 `meta` 包裹会被静默过滤、exports 接线、刷新不生效怎么排查）
> → 技能 **`dsh-plugin-localization`**。这一节只管「什么时候做 + 做完要交什么」。






