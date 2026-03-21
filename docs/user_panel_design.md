---
summary: Internal Usage Admin Panel design — architecture, security, data access, and UI for ops/billing/product-owner tooling (not end-user facing).
read_when:
  - Building or changing the internal admin service or usage dashboard.
  - Defining security boundaries, DB roles, or network access for admin tooling.
  - Designing admin pages for runs, credits, ledger health, or funnel/blockers.
---

---
summary: Internal admin ops console spec covering launch funnel visibility, billing integrity, user drilldown, and always-on cost monitoring.
read_when:
  - Implementing `/admin/usage` or related internal admin dashboards.
  - Designing launch funnel, ledger health, blocker analysis, or always-on shadow monitoring.
---

# Internal Usage Admin Panel 设计稿

## 1. 目标

这个服务不是给终端用户看的，而是给产品 owner / 运营 / 计费调试使用的内部控制台。

核心目标只有四个：

1. 看用户有没有真的完成购买后启动 Run 的闭环
2. 看 launch 被什么原因拦住
3. 看 credit ledger 有没有错账、重复扣费、悬空 reserve
4. 看哪些 plan / 用户在高成本运行，是否需要调整 pricing 或限制

---

## 2. 架构决策

### 结论

**单独起一个内部服务是正确的。**

但要注意：

* 它不应该复用产品站点的公开路由
* 它不应该暴露到普通用户的应用导航里
* 它不应该用和产品主服务一样宽的数据库权限

### 推荐拓扑

```text
Browser (only you)
  -> Cloudflare Access / Tailscale / VPN / IP allowlist
    -> Internal Admin Service
      -> Read-only DB role to primary or read replica
      -> Optional: small internal write API for manual adjustments / alerts ack
```

### 最佳实践优先级

1. **最好：读副本 + 只读 DB role**
2. **次优：主库 + 严格只读 DB role**
3. **最差：主库 + 和产品服务共用写权限账号**

### 为什么

你现在说“共用一个数据库”，这个可以，但不能共用同一个高权限连接身份。

如果这个内部服务被打穿，而它拿的是主应用同等级写权限：

* 用户数据会被读走
* ledger 可能被篡改
* run 状态可能被污染
* 风险不比把看板放进产品小多少

---

## 3. 安全边界建议

### 3.1 网络层

至少做以下之一：

* Cloudflare Access
* Tailscale Funnel / Tailnet only
* 公司 / 家庭固定 IP allowlist
* VPN only ingress

### 3.2 身份层

不要自己造复杂多用户系统。

因为你说只有你能访问，所以最简单的是：

* 单管理员身份
* OIDC / Google SSO / GitHub SSO + allowlist 你的邮箱
* 再叠加一层 Cloudflare Access 或 VPN

### 3.3 数据库权限

拆 2 个 DB user：

#### `admin_ro`

* 只能 SELECT
* 可读视图 / materialized view
* 不能 UPDATE / DELETE / INSERT

#### `admin_ops_rw`（可选）

* 仅用于极少数人工操作
* 比如：ack alert、写 internal notes、手动生成 billing adjustment proposal
* **不要直接给它改核心 user/order/run 表的权限**

### 3.4 应用层

* 整个服务不需要公开注册/登录
* 不需要普通用户 session
* 不需要暴露给搜索引擎
* 关闭所有不必要的 public asset indexing
* 响应头加 no-store / no-cache

---

## 4. 服务职责边界

### Internal Admin Service 应该做的

* 读取 usage / run / ledger / subscription 数据
* 聚合指标
* 展示 dashboard
* 展示告警
* 提供 drilldown 查询
* 可选：导出 CSV

### 不应该做的

* 不应该承担主产品用户认证
* 不应该成为 run launch 的生产入口
* 不应该直接复用用户态 API contract
* 不应该承接 Stripe webhook / Telegram webhook

换句话说：

**它是观察面，不是业务主通路。**

### Runtime meaning metrics

TTL / cleanup 相关的 admin 看板，优先盯这些“有意义指标”，不要堆 vanity metrics：

* 每个 plan 的平均 launch / wake 次数
* 每次 run 的平均 workspace minutes
* P50 / P90 session minutes
* idle stop 占比
* hard TTL hit 占比
* failed run 占比
* top 5% 重度用户资源占用
* 每个 plan 的 estimated internal cost

当前实现口径：

* `run_usage`:
  * 平均 workspace minutes / run：按窗口内 finished runs，且只统计有正数 `workspace_minutes` 的行
  * failed run 占比：按窗口内 finished runs，分母是 finished runs，分子是 `status_snapshot = failed`
  * 每个 plan 的 estimated internal cost：优先用 `estimated_internal_cost_cents`，缺失或过低时回退到 `workspace_minutes * provider_cost_per_minute`
* `runtime_intervals` + `runtime_instances`:
  * session minutes 分布：按 `ended_at` 落在窗口内的 sessions
  * idle stop / hard TTL hit 占比：按窗口内 ended sessions 的 `close_reason`
  * launch / wake 次数：按 `started_at` 落在窗口内的 sessions；平均值分母是窗口内实际发起 launch / wake 的用户数
  * top 5% 用户 runtime minute 占比

实现细节：

* session 指 `runtime_intervals` 的一段 active runtime window
* 如果某个 run 还没有 `runtime_intervals`，才回退到 `run_usage` 的 lifecycle 时间，避免部分有 interval、部分没有时把无 interval 的 run 整体漏掉
* `active users` 和 `launch/wake users` 不是同一个口径：
  * `active users` = 在窗口内有 runtime overlap 的用户
  * `launch/wake users` = 在窗口内真正开始了一个 session 的用户
* provider runtime 成本当前按 `0.27654 cents / min` 估算，并写回 / 展示为 cents

不要为了看板再加新字段；优先用现有 `run_usage` / `runtime_instances` / `runtime_intervals` 推导。

### Runs tab

`/admin/usage` 应该有一个单独的 Runs 视图：

* 默认只读最近一页，比如 20 条
* 必须按 `created_at desc` 分页，不能一次把全量 run 拉到前端
* 每行至少要能看清：
  * run 状态
  * runtime 状态
  * plan
  * user / order
  * 最近 activity
  * termination reason
  * workspace minutes
  * estimated internal cost
* 点开后要能 drill down 到：
  * `run_usage`
  * `runtime_instances`
  * 最近 `runtime_intervals`
  * channel token / pairing 状态
  * TTL policy snapshot

目标不是“漂亮表格”，而是让 owner 能快速判断某个 run 到底卡在哪一层。

---

## 5. 数据访问设计

### 5.1 推荐数据源

直接读这些表 / 视图：

* `user_subscriptions`
* `credit_ledger`
* `run_usage`
* `runs`
* `orders`
* `run_channel_configs`
* `launch_attempts`（建议新增）
* `billing_alerts`（建议新增）

### 5.2 建议新增表

#### `launch_attempts`

作用：记录所有 launch 尝试，包括被 precheck 拦截的情况。

```sql
create table launch_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  order_id uuid not null,
  plan_code_snapshot text not null,
  agent_count_snapshot integer not null,
  remaining_credits_snapshot integer,
  attempted_at timestamptz not null default now(),
  result text not null check (
    result in ('blocked', 'reserved', 'provider_accepted', 'failed_before_accept')
  ),
  blocker_reason text,
  metadata_json jsonb not null default '{}'::jsonb
);
```

没有这张表，你会很难分析：

* 到底多少人想 launch
* 有多少人是被拦，不是没意愿
* 是哪种 blocker 最伤转化

当前实现备注：

* 应用代码已开始写入 `launch_attempts`，admin dashboard 也会优先读取它
* 如果现网数据库还没建这张表，产品主流程不会被阻断；admin 会自动回退到推导口径
* 部署后仍需执行 schema rollout（例如 `pnpm db:push`）

#### `billing_alerts`

作用：提前把异常落表，而不是每次进 dashboard 临时计算。

```sql
create table billing_alerts (
  id uuid primary key default gen_random_uuid(),
  alert_type text not null check (
    alert_type in (
      'stale_reserve',
      'balance_mismatch',
      'negative_balance',
      'duplicate_idempotency',
      'refund_chain_error'
    )
  ),
  severity text not null check (severity in ('info', 'warning', 'critical')),
  entity_type text not null,
  entity_id uuid,
  message text not null,
  metadata_json jsonb not null default '{}'::jsonb,
  acknowledged_at timestamptz,
  created_at timestamptz not null default now()
);
```

当前实现备注：

* 已落地 `billing_alerts` schema + internal sync / ack API
* admin dashboard / internal usage API 读取快照时会先尝试自动 sync 持久化告警；没有表或 sync 失败时回退到推导口径
* 页面上仍保留 manual sync 按钮，方便立即强制刷新
* 部署后仍需执行 schema rollout（例如 `pnpm db:push`），再调用内部 sync 接口生成首批告警

---

## 6. 页面信息架构

## 页面：`/admin/usage`

### 第一屏：Global Overview

6 张卡片：

1. **Active Paid Users**

   * 当前 active 且非 free 的订阅用户数

2. **Bundle -> First Launch Rate**

   * 已购买 bundle 中，至少成功 launch 一次的比例

3. **Launch Success Rate**

   * provider accepted / launch attempts

4. **Blocked Launches Today**

   * 今日被拦截 launch 数

5. **Credits Committed Today**

   * 今日 commit 次数 / 净消耗

6. **Estimated Cost Today**

   * 今日 run_usage.estimated_internal_cost_cents 汇总

顶部还要有一个 **Alert Banner**：

* stale pending reserves > 0
* balance mismatch users > 0
* provider failure spike

---

### 第二屏：Funnel + Blockers

#### Left: Launch Funnel

步骤：

1. order created
2. Telegram token validated
3. pairing completed
4. launch attempted
5. launch admitted
6. provider accepted
7. run completed

#### Right: Blocked Launches by Reason

按 blocker_reason 分组柱状图：

* no_runtime_access
* telegram_not_ready
* credits_exhausted
* bundle_too_large
* concurrent_limit
* active_bundle_limit

---

### 第三屏：Runtime Usage

#### 图 1：Launches per day

分组：

* provider_accepted
* failed_before_accept
* refunded
* completed

#### 图 2：Launches by plan

* run
* warm_standby
* always_on

#### 图 3：Avg workspace minutes by plan

#### 图 4：Peak concurrent runs

---

### 第四屏：Billing Integrity

#### Widget 1: Ledger Health Summary

显示：

* total grants
* total reserves
* total commits
* total refunds
* net credits consumed
* stale pending reserves
* balance mismatch count

#### Widget 2: Recent Ledger Anomalies

表格展示最近 50 条异常：

* duplicate idempotency
* reserve pending timeout
* commit after reversed
* refund without reserve
* negative resulting balance

#### Widget 3: Balance Mismatch Table

列：

* user_id
* subscription_id
* stored remaining_credits
* recomputed balance
* diff
* last ledger event at

---

### 第五屏：User Drilldown Table

可搜索表格，列：

* user
* current plan
* remaining credits
* current period end
* launches this period
* blocked launches this period
* avg workspace minutes
* est cost this period
* pairing ready
* last launch at

当前实现备注：

* 表格里的 activity 指标（launches / blocked / avg minutes / est cost）现在跟随顶部时间窗口
* `current period end` 已在 UI 中明确为 subscription end，避免和顶部 window 语义混淆

点开一行显示右侧抽屉：

#### A. Subscription

* plan_code
* plan_version
* included_credits
* remaining_credits
* current_period_start/end

#### B. Ledger Timeline

* 最近 20 条 grant/reserve/commit/refund

#### C. Run Timeline

* recent runs
* status
* provider accepted at
* workspace minutes
* termination reason

#### D. Bundle Readiness

* purchased bundles count
* paired bundles count
* launch blocked bundles count

---

### 第六屏：Always On Shadow Monitor

单独区域，不要跟 Run/Warm 混看。

显示：

* always_on active users
* avg workspace minutes / day
* avg active bundles
* avg concurrent runs
* top 10 users by estimated cost
* top 10 users by idle occupancy ratio

---

## 7. 你真正应该关注的指标

## 一级指标（每天看）

### 1. Active Paid Users

意义：真正拥有 runtime entitlement 的用户数。

### 2. Bundle -> First Launch Rate

意义：付费后是否真正进入核心价值时刻。

### 3. Launch Success Rate

意义：你的系统是否能稳定把用户带进真实运行。

### 4. Blocked Launch Rate by Reason

意义：看 friction 是 price、Telegram setup 还是 gating 本身。

### 5. Net Credits Consumed

意义：当前最接近真实 consumption 的指标。

### 6. Avg Workspace Minutes / Successful Launch

意义：未来是否要从 flat launch credit 走向 occupancy pricing 的关键影子变量。

### 7. Estimated Cost per User / per Plan

意义：看哪些用户或 plan 在亏钱。

### 8. Stale Pending Reserves

意义：账本健康报警器。

---

## 二级指标（每周看）

### 9. Repeat Launch Rate

* 至少完成 2 次成功 launch 的用户比例

### 10. Warm Standby Adoption

* active paid users 中 warm_standby 占比

### 11. Always On Shadow Cost Ratio

* always_on 用户估算成本 / 其订阅收入

### 12. Blocker Conversion Loss

* 被 blocker 拦住后 7 天内没有升级或没有完成配置的用户比例

### 13. Cost Concentration

* top 5% 用户占总估算成本的比例

---

## 8. UI 设计建议

### 风格原则

不要做成 consumer 产品风格。

应该是：

* 高信息密度
* 快速扫描
* 低装饰
* 警报明确
* drilldown 简洁

### 推荐布局

* 左侧窄导航
* 顶部时间范围筛选（24h / 7d / 30d / custom）
* 主内容区为 cards + charts + tables
* 异常用红 / 黄高亮
* 默认按最近 7 天展示

### 筛选器

全局筛选：

* date range
* plan_code
* status
* user
* order_id
* run_id

当前实现备注：

* 预置时间窗口 `24h / 7d / 30d` 已可用
* `custom` 已支持，通过 `range=custom&start=YYYY-MM-DD&end=YYYY-MM-DD` 驱动服务端聚合
* UI 侧已提供自定义起止日期输入并刷新 dashboard

---

## 9. API 设计建议

这个 admin service 不要直接把 SQL 写在前端页面里。

建议做内部 API：

* `GET /api/overview`
* `GET /api/funnel`
* `GET /api/blockers`
* `GET /api/runtime-usage`
* `GET /api/billing-health`
* `GET /api/users`
* `GET /api/users/:userId`
* `GET /api/always-on-shadow`
* `GET /api/alerts`

当前实现备注：

* 已落地站内只读内部接口：`/api/admin/usage` 及 overview / funnel / blockers / runtime-usage / billing-health / users / users/:userId / always-on-shadow / alerts 子路由
* `/api/admin/usage/users` 现已支持 `plan` / `status` / `health` / `order_id` / `run_id` / `q` 过滤参数
* 页面仍可直接走 server service；后续可切换到这些内部 API 而不改聚合逻辑

这样以后你想把底层换成 view/materialized view，不会牵连 UI。

---

## 10. SQL / 聚合建议

### `overview_metrics_view`

聚合：

* active_paid_users
* first_launch_rate
* launch_success_rate
* blocked_launches_today
* credits_committed_today
* estimated_cost_today

### `billing_health_view`

聚合：

* stale_pending_reserves
* balance_mismatch_count
* duplicate_idempotency_count
* refunds_today

### `user_usage_summary_view`

聚合到 user 粒度：

* plan
* remaining_credits
* launches_period
* blocked_launches_period
* avg_workspace_minutes
* est_cost_period

如果数据量起来，再做 materialized view。

---

## 11. 技术栈建议

如果你主产品已经是 Next.js / React：

* Internal admin service 也可以用 Next.js
* 但部署成独立项目、独立域名、独立 env、独立 DB user

部署建议：

* `admin.yourdomain.internal` 或单独私有域名
* Vercel + Cloudflare Access，或 Fly.io / Railway + Access layer
* 不要和公开产品共用同一个 public origin

---

## 12. 最关键的非功能要求

1. **默认只读**
2. **和主产品不同 DB 用户**
3. **和主产品不同部署单元**
4. **只有你自己的身份能进**
5. **不承担主业务写路径**
6. **所有异常可追溯到 user / order / run / ledger event**

---

## 13. 最后判断

这个内部面板的价值不在于“看数据多漂亮”。

它的价值在于：

* 让你知道是价格错了，还是 onboarding 卡了
* 让你知道是用户没需求，还是 launch 根本没成功
* 让你知道 ledger 是健康的，还是已经悄悄坏账
* 让你知道 Always On 是真实高价值用户，还是高成本幻觉

所以它应该首先是一个：

**运营 + 计费完整性 + 成本观察控制台**

而不是一个“分析味很浓但无法做决策”的 BI 看板。
