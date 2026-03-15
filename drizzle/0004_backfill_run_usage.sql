WITH order_item_counts AS (
  SELECT
    oi.order_id,
    COUNT(*)::integer AS agent_count
  FROM order_items oi
  GROUP BY oi.order_id
),
run_backfill AS (
  SELECT
    CONCAT('run-usage-', md5(r.id || clock_timestamp()::text || random()::text)) AS id,
    r.id AS run_id,
    r.user_id,
    r.order_id,
    COALESCE(us.plan_id, 'free'::subscription_plan_id) AS plan_id,
    'v1'::text AS plan_version,
    CASE COALESCE(us.plan_id, 'free'::subscription_plan_id)
      WHEN 'run'::subscription_plan_id THEN 'manual'
      WHEN 'warm_standby'::subscription_plan_id THEN 'auto_wake'
      WHEN 'always_on'::subscription_plan_id THEN 'always_active'
      ELSE 'none'
    END AS trigger_mode_snapshot,
    COALESCE(oic.agent_count, 0) AS agent_count,
    r.uses_real_workspace,
    r.uses_tools,
    r.network_enabled,
    r.created_at AS provisioning_started_at,
    r.started_at AS provider_accepted_at,
    r.started_at AS running_started_at,
    r.completed_at,
    CASE
      WHEN r.status IN ('completed', 'failed') THEN COALESCE(r.completed_at, r.updated_at)
      ELSE NULL
    END AS workspace_released_at,
    NULL::text AS termination_reason,
    r.status AS status_snapshot,
    CASE COALESCE(us.plan_id, 'free'::subscription_plan_id)
      WHEN 'run'::subscription_plan_id THEN jsonb_build_object(
        'cleanupGraceMinutes', 5,
        'heartbeatMissingMinutes', null,
        'idleTimeoutMinutes', 20,
        'maxSessionTtlMinutes', 120,
        'provisioningTimeoutMinutes', 15,
        'triggerMode', 'manual',
        'unhealthyProviderTimeoutMinutes', null
      )
      WHEN 'warm_standby'::subscription_plan_id THEN jsonb_build_object(
        'cleanupGraceMinutes', 10,
        'heartbeatMissingMinutes', null,
        'idleTimeoutMinutes', 45,
        'maxSessionTtlMinutes', 360,
        'provisioningTimeoutMinutes', 15,
        'triggerMode', 'auto_wake',
        'unhealthyProviderTimeoutMinutes', null
      )
      WHEN 'always_on'::subscription_plan_id THEN jsonb_build_object(
        'cleanupGraceMinutes', null,
        'heartbeatMissingMinutes', 15,
        'idleTimeoutMinutes', null,
        'maxSessionTtlMinutes', null,
        'provisioningTimeoutMinutes', 15,
        'triggerMode', 'always_active',
        'unhealthyProviderTimeoutMinutes', 10
      )
      ELSE jsonb_build_object(
        'cleanupGraceMinutes', null,
        'heartbeatMissingMinutes', null,
        'idleTimeoutMinutes', null,
        'maxSessionTtlMinutes', null,
        'provisioningTimeoutMinutes', 15,
        'triggerMode', 'none',
        'unhealthyProviderTimeoutMinutes', null
      )
    END AS ttl_policy_snapshot,
    r.created_at,
    r.updated_at
  FROM runs r
  LEFT JOIN user_subscriptions us ON us.user_id = r.user_id
  LEFT JOIN order_item_counts oic ON oic.order_id = r.order_id
  LEFT JOIN run_usage ru ON ru.run_id = r.id
  WHERE ru.run_id IS NULL
)
INSERT INTO run_usage (
  id,
  run_id,
  user_id,
  order_id,
  plan_id,
  plan_version,
  trigger_mode_snapshot,
  agent_count,
  uses_real_workspace,
  uses_tools,
  network_enabled,
  provisioning_started_at,
  provider_accepted_at,
  running_started_at,
  completed_at,
  workspace_released_at,
  termination_reason,
  status_snapshot,
  ttl_policy_snapshot,
  created_at,
  updated_at
)
SELECT
  id,
  run_id,
  user_id,
  order_id,
  plan_id,
  plan_version,
  trigger_mode_snapshot,
  agent_count,
  uses_real_workspace,
  uses_tools,
  network_enabled,
  provisioning_started_at,
  provider_accepted_at,
  running_started_at,
  completed_at,
  workspace_released_at,
  termination_reason,
  status_snapshot,
  ttl_policy_snapshot,
  created_at,
  updated_at
FROM run_backfill;
