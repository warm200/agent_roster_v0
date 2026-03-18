---
summary: Runtime credit-consumption policy draft covering reserve, commit, refund, and ledger/run-usage design.
read_when:
  - Implementing subscription credit deduction or refund behavior.
  - Reasoning about launch credits versus wake credits versus always-on budget.
---

## 1) 设计原则

先定死这几条，不然后面会反复返工：

* **Run / Warm Standby：1 次成功 launch / wake = 1 credit**
* **Always On 不走同一套硬扣规则**
* **launch 前 reserve，provider 接受后 commit，provider 未接受则 refund**
* **mid-run 不因为 credit 不足而中断**
* **usage telemetry 和 billing ledger 分表**

这么做的原因很直接：你现在已经有 launch 前的余额 gate，但还没有自动扣减，也没有 credit 消耗公式；而且 `triggerMode` / `alwaysOnBundles` 还没完全变成真实运行时行为。

补充：现在还支持一次性 top-up 包。

* `Quick Refill`: `+10` credits = `$5.99`
* `Builder Pack`: `+25` credits = `$12.99`
* `Power Pack`: `+60` credits = `$24.99`
* top-up credits expire `90 days` after purchase
* top-up credits are consumed before the non-expiring subscription balance

---

## 2) Postgres schema

### `user_subscriptions`

```sql
create table user_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id),

  plan_code text not null check (plan_code in ('free', 'run', 'warm_standby', 'always_on')),
  plan_version text not null default 'v1',

  billing_interval text not null check (billing_interval in ('none', 'one_time', 'monthly')),
  included_credits integer not null default 0,
  remaining_credits integer not null default 0,

  current_period_start_at timestamptz,
  current_period_end_at timestamptz,

  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_checkout_session_id text,

  status text not null check (status in ('active', 'canceled', 'expired', 'past_due')) default 'active',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (user_id)
);

create index idx_user_subscriptions_user_id on user_subscriptions(user_id);
```

### `credit_ledger`

```sql
create table credit_ledger (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references users(id),
  subscription_id uuid not null references user_subscriptions(id),
  order_id uuid,
  run_id uuid,

  event_type text not null check (
    event_type in (
      'grant',
      'reset',
      'reserve',
      'commit',
      'refund',
      'adjust',
      'expire',
      'shadow_usage_estimate'
    )
  ),

  unit_type text not null check (
    unit_type in (
      'launch_credit',
      'wake_credit',
      'always_on_budget',
      'fair_use_adjustment'
    )
  ),

  delta_credits integer not null,
  resulting_balance integer,

  status text not null check (status in ('pending', 'committed', 'reversed')) default 'committed',
  reason_code text not null,
  idempotency_key text not null,
  metadata_json jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);

create unique index uq_credit_ledger_idempotency_key on credit_ledger(idempotency_key);
create index idx_credit_ledger_user_id_created_at on credit_ledger(user_id, created_at desc);
create index idx_credit_ledger_run_id on credit_ledger(run_id);
```

### `run_usage`

这个表是**成本学习**，不是扣费事实表。

```sql
create table run_usage (
  id uuid primary key default gen_random_uuid(),

  run_id uuid not null unique references runs(id),
  user_id uuid not null references users(id),
  order_id uuid not null,

  plan_code text not null,
  plan_version text not null,

  trigger_mode_snapshot text not null,
  agent_count integer not null,

  uses_real_workspace boolean not null default false,
  uses_tools boolean not null default false,
  network_enabled boolean not null default false,

  provisioning_started_at timestamptz,
  provider_accepted_at timestamptz,
  running_started_at timestamptz,
  completed_at timestamptz,

  workspace_minutes integer,
  tool_calls_count integer,
  input_tokens_est integer,
  output_tokens_est integer,
  estimated_internal_cost_cents integer,

  status_snapshot text not null check (
    status_snapshot in ('provisioning', 'running', 'completed', 'failed')
  ),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_run_usage_user_id_created_at on run_usage(user_id, created_at desc);
create index idx_run_usage_plan_code on run_usage(plan_code);
```

### 可选：`run_credit_events_view`

给后台查账用：

```sql
create view run_credit_events_view as
select
  cl.run_id,
  cl.user_id,
  cl.event_type,
  cl.delta_credits,
  cl.resulting_balance,
  cl.reason_code,
  cl.status,
  cl.created_at
from credit_ledger cl
where cl.run_id is not null;
```

---

## 3) TypeScript types

```ts
export type PlanCode = 'free' | 'run' | 'warm_standby' | 'always_on';
export type BillingInterval = 'none' | 'one_time' | 'monthly';
export type SubscriptionStatus = 'active' | 'canceled' | 'expired' | 'past_due';

export type LedgerEventType =
  | 'grant'
  | 'reset'
  | 'reserve'
  | 'commit'
  | 'refund'
  | 'adjust'
  | 'expire'
  | 'shadow_usage_estimate';

export type LedgerUnitType =
  | 'launch_credit'
  | 'wake_credit'
  | 'always_on_budget'
  | 'fair_use_adjustment';

export type LedgerStatus = 'pending' | 'committed' | 'reversed';

export type RunStatus = 'provisioning' | 'running' | 'completed' | 'failed';

export interface UserSubscription {
  id: string;
  userId: string;
  planCode: PlanCode;
  planVersion: string;
  billingInterval: BillingInterval;
  includedCredits: number;
  remainingCredits: number;
  currentPeriodStartAt?: string;
  currentPeriodEndAt?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  stripeCheckoutSessionId?: string;
  status: SubscriptionStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreditLedgerRow {
  id: string;
  userId: string;
  subscriptionId: string;
  orderId?: string;
  runId?: string;
  eventType: LedgerEventType;
  unitType: LedgerUnitType;
  deltaCredits: number;
  resultingBalance?: number;
  status: LedgerStatus;
  reasonCode: string;
  idempotencyKey: string;
  metadataJson: Record<string, unknown>;
  createdAt: string;
}

export interface RunUsageRow {
  id: string;
  runId: string;
  userId: string;
  orderId: string;
  planCode: PlanCode;
  planVersion: string;
  triggerModeSnapshot: string;
  agentCount: number;
  usesRealWorkspace: boolean;
  usesTools: boolean;
  networkEnabled: boolean;
  provisioningStartedAt?: string;
  providerAcceptedAt?: string;
  runningStartedAt?: string;
  completedAt?: string;
  workspaceMinutes?: number;
  toolCallsCount?: number;
  inputTokensEst?: number;
  outputTokensEst?: number;
  estimatedInternalCostCents?: number;
  statusSnapshot: RunStatus;
  createdAt: string;
  updatedAt: string;
}
```

---

## 4) 运行时扣减规则

这部分是核心，别搞花。

### A. 购买 plan 后

你当前购买成功后会 upsert 到 `user_subscriptions`，并把 credits reset 到该 plan 自带额度。这个可以先保留。

#### 写一条 ledger

* `event_type = grant` 或 `reset`
* `delta_credits = included_credits`
* `reason_code = plan_purchase`

---

### B. launch 前 precheck

你现在 launch 前已有这些 gate：

* runtime access
* agents per bundle
* concurrent runs
* active bundles
* remaining credits > 0
* Telegram pairing complete

这里新增一条：

* `Run / Warm Standby` 才会走硬 credit reserve
* `Always On` 只做 shadow usage，不在这里硬扣

---

### C. reserve

当用户点击 launch：

* 开事务
* `SELECT ... FOR UPDATE` 锁住 `user_subscriptions`
* 检查 `remaining_credits >= 1`
* 扣 1
* 写一条 `reserve`

### D. commit

provider 接受 run 创建成功后：

* 写 `commit`
* 不再二次扣减，只是把之前 reserve 变成正式消费

### E. refund

如果 provider 根本没接受，或者 run 创建前失败：

* 把那 1 个 credit 加回去
* 写 `refund`
* reserve 标 `reversed`

### F. run 已创建后失败

不退款。

原因不是“坑用户”，而是你已经发生了 orchestration 成本，而且不然用户会疯狂重试薅系统。你现在的 Run 生命周期也明确有 `provisioning/running/completed/failed`。

---

## 5) launch 伪代码

```ts
async function launchRun(params: {
  userId: string;
  orderId: string;
  idempotencyKey: string;
}) {
  const { userId, orderId, idempotencyKey } = params;

  // 1. load order + subscription + channel config
  const order = await getOrderForUser(userId, orderId);
  const subscription = await getUserSubscription(userId);
  const channelConfig = await getRunChannelConfig(orderId);

  // 2. precheck: these are already part of your product semantics
  await assertOrderPaid(order);
  await assertTelegramReady(channelConfig);
  await assertRuntimeAccess(subscription);
  await assertAgentsPerBundleWithinLimit(order, subscription);
  await assertConcurrentRunsWithinLimit(userId, subscription);
  await assertActiveBundlesWithinLimit(userId, subscription);

  const requiresHardCredit =
    subscription.planCode === 'run' || subscription.planCode === 'warm_standby';

  let reserveLedgerId: string | null = null;

  if (requiresHardCredit) {
    reserveLedgerId = await db.tx(async (tx) => {
      const sub = await tx.one<UserSubscription>(
        `select * from user_subscriptions where user_id = $1 for update`,
        [userId]
      );

      if (sub.remainingCredits < 1) {
        throw new Error('CREDITS_EXHAUSTED');
      }

      const newBalance = sub.remainingCredits - 1;

      await tx.none(
        `update user_subscriptions
         set remaining_credits = $2, updated_at = now()
         where id = $1`,
        [sub.id, newBalance]
      );

      const ledger = await tx.one<{ id: string }>(
        `insert into credit_ledger (
          user_id, subscription_id, order_id, event_type, unit_type,
          delta_credits, resulting_balance, status, reason_code,
          idempotency_key, metadata_json
        ) values (
          $1, $2, $3, 'reserve', 'launch_credit',
          -1, $4, 'pending', 'run_launch_reserve',
          $5, $6::jsonb
        )
        returning id`,
        [
          userId,
          sub.id,
          orderId,
          newBalance,
          `reserve:${idempotencyKey}`,
          JSON.stringify({ planCode: sub.planCode, orderId }),
        ]
      );

      return ledger.id;
    });
  }

  // 3. create local run row first
  const run = await createRunRow({
    userId,
    orderId,
    status: 'provisioning',
  });

  try {
    // 4. create run in provider
    const providerResp = await runProvider.createRun({
      runId: run.id,
      order,
      channelConfig,
    });

    // 5. mark provider accepted
    await markRunProviderAccepted(run.id, providerResp);

    // 6. commit reserve if needed
    if (requiresHardCredit && reserveLedgerId) {
      await markReserveCommitted({
        reserveLedgerId,
        userId,
        runId: run.id,
        idempotencyKey: `commit:${idempotencyKey}`,
      });
    }

    // 7. create usage row
    await upsertRunUsage({
      runId: run.id,
      userId,
      orderId,
      planCode: subscription.planCode,
      planVersion: subscription.planVersion,
      triggerModeSnapshot: getTriggerMode(subscription.planCode),
      agentCount: order.items.length,
      usesRealWorkspace: true,
      usesTools: true,
      networkEnabled: true,
      statusSnapshot: 'provisioning',
      provisioningStartedAt: new Date().toISOString(),
      providerAcceptedAt: new Date().toISOString(),
    });

    return run;
  } catch (err) {
    // 8. refund reserve if provider never accepted
    if (requiresHardCredit && reserveLedgerId) {
      await refundReserve({
        reserveLedgerId,
        userId,
        orderId,
        runId: run.id,
        idempotencyKey: `refund:${idempotencyKey}`,
        reasonCode: 'launch_failed_before_provider_accept',
      });
    }

    await markRunFailed(run.id, err);
    throw err;
  }
}
```

---

## 6) reserve / commit / refund 辅助函数

### `markReserveCommitted`

```ts
async function markReserveCommitted(args: {
  reserveLedgerId: string;
  userId: string;
  runId: string;
  idempotencyKey: string;
}) {
  await db.tx(async (tx) => {
    const reserve = await tx.oneOrNone(
      `select * from credit_ledger where id = $1 for update`,
      [args.reserveLedgerId]
    );

    if (!reserve) throw new Error('RESERVE_NOT_FOUND');
    if (reserve.status === 'committed') return;
    if (reserve.status === 'reversed') throw new Error('RESERVE_ALREADY_REVERSED');

    await tx.none(
      `update credit_ledger
       set status = 'committed', run_id = $2
       where id = $1`,
      [args.reserveLedgerId, args.runId]
    );

    await tx.none(
      `insert into credit_ledger (
        user_id, subscription_id, run_id, event_type, unit_type,
        delta_credits, resulting_balance, status, reason_code,
        idempotency_key, metadata_json
      )
      values (
        $1, $2, $3, 'commit', $4,
        0, $5, 'committed', 'run_launch_commit',
        $6, $7::jsonb
      )`,
      [
        reserve.user_id,
        reserve.subscription_id,
        args.runId,
        reserve.unit_type,
        reserve.resulting_balance,
        args.idempotencyKey,
        JSON.stringify({ reserveLedgerId: args.reserveLedgerId }),
      ]
    );
  });
}
```

### `refundReserve`

```ts
async function refundReserve(args: {
  reserveLedgerId: string;
  userId: string;
  orderId: string;
  runId: string;
  idempotencyKey: string;
  reasonCode: string;
}) {
  await db.tx(async (tx) => {
    const reserve = await tx.oneOrNone(
      `select * from credit_ledger where id = $1 for update`,
      [args.reserveLedgerId]
    );

    if (!reserve) throw new Error('RESERVE_NOT_FOUND');
    if (reserve.status === 'reversed') return;

    const sub = await tx.one<UserSubscription>(
      `select * from user_subscriptions where id = $1 for update`,
      [reserve.subscription_id]
    );

    const newBalance = sub.remainingCredits + 1;

    await tx.none(
      `update user_subscriptions
       set remaining_credits = $2, updated_at = now()
       where id = $1`,
      [sub.id, newBalance]
    );

    await tx.none(
      `update credit_ledger
       set status = 'reversed'
       where id = $1`,
      [args.reserveLedgerId]
    );

    await tx.none(
      `insert into credit_ledger (
        user_id, subscription_id, order_id, run_id, event_type, unit_type,
        delta_credits, resulting_balance, status, reason_code,
        idempotency_key, metadata_json
      ) values (
        $1, $2, $3, $4, 'refund', $5,
        +1, $6, 'committed', $7,
        $8, $9::jsonb
      )`,
      [
        args.userId,
        reserve.subscription_id,
        args.orderId,
        args.runId,
        reserve.unit_type,
        newBalance,
        args.reasonCode,
        args.idempotencyKey,
        JSON.stringify({ reserveLedgerId: args.reserveLedgerId }),
      ]
    );
  });
}
```

---

## 7) Always On 的处理方式

这里别自作聪明。

你现在的文档已经说明 `always_active` 和 `alwaysOnBundles` 还没完全变成真实运行时 enforcement。
所以 **Always On 暂时不要跟 Run/Warm 共用“1 次 launch = 1 credit”**。

### 现在这样做就够了

* 继续收月费
* 继续受 entitlement 限制
* 每次相关行为写 `shadow_usage_estimate`
* 只在后台看：

  * workspace 占用分钟
  * 活跃 bundle 数
  * 重度用户分布

### 示例 ledger

```sql
event_type = 'shadow_usage_estimate'
unit_type = 'always_on_budget'
delta_credits = 0
reason_code = 'always_on_observation'
```

也就是说，**先观察，不先乱收**。

---

## 8) 必须处理的边界条件

### 幂等

Stripe webhook、provider callback、前端重复点击，都会重放。
所以 `idempotency_key` 必须唯一。

### 并发点击 Run

必须 `FOR UPDATE` 锁 subscription 行，不然余额会被穿透。

### retry / rerun

算一次新的消费。
因为这是新的 Run 创建，不是原 run 的免费附赠。你的 Run 模型本来就是独立实例。

### mid-run credit 不足

当前 run 继续，下一次 launch 再拦。

### plan upgrade

你现在先接受“买新 plan 会覆盖旧 included/remaining credits”，因为当前文档就是这么写的。
但前台文案必须讲清楚，不然用户会觉得你吞余额。

---

## 9) 第一版监控指标

你不是“先 monitor 再决定扣不扣”。
你是“**已经有稳定扣减规则，同时 monitor 未来怎么优化**”。

先只看这 5 个：

* 每个 plan 的平均 launch 次数
* 每次 run 的平均 workspace minutes
* failed run 占比
* agent_count 对成本的影响
* top 5% 重度用户资源占用

这些字段跟你的 Run lifecycle 和 runtime disclosure 是对得上的。

---

## 10) 你现在该怎么交给 AI 写

你可以直接把下面这段扔给 Claude / Codex：

```text
Implement runtime credit deduction for AgentRoster.

Requirements:
1. Keep current entitlement checks:
   - runtime access
   - agents per bundle
   - concurrent runs
   - active bundles
   - remaining credits > 0
   - Telegram pairing complete

2. Add hard credit deduction only for plan_code in ('run', 'warm_standby'):
   - 1 successful launch or wake = 1 credit
   - reserve before provider createRun
   - commit after provider accepted
   - refund if provider never accepted
   - no refund after provider accepted, even if run later fails
   - no mid-run interruption due to balance depletion
   - rerun/retry counts as a new credit event

3. Do NOT hard-charge always_on with the same logic yet.
   - only record shadow usage estimates for always_on

4. Add/modify tables:
   - user_subscriptions
   - credit_ledger
   - run_usage

5. Make all billing operations idempotent.
6. Use DB transaction + SELECT FOR UPDATE on subscription row when reserving/refunding credits.
7. Add tests for:
   - double click launch
   - provider reject before accept
   - provider accept then later fail
   - insufficient credits
   - duplicate webhook/callback
```

---

最关键的一句：

**你现在不是要做“完美计费系统”，而是要先做“不会算错账、不会重复扣、不会中途断”的最小计费内核”。**

你要的话，我下一条直接给你：
**Drizzle / Prisma migration 版本**，或者 **Nest/Next API route 版本**。
