---
summary: Product requirements for the Trusted Personal Ops Agents Run Platform Phase 1 scope.
read_when:
  - Updating product scope, user flows, preview chat behavior, checkout, bundles, or runs.
---

PRD：Trusted Personal Ops Agents Run Platform（Phase 1）

1. 项目概述

1.1 项目名称

Trusted Personal Ops Agents Run Platform

1.2 一句话定位

一个用于发现、预览、购买、配置并运行 Personal Ops Agents 的产品化平台。用户可以浏览多个 agent，将其加入购物车，完成购买后，通过一个统一的 Telegram 配置向导完成渠道连接，然后一键启动 Run，在站内查看运行状态、日志和结果。

1.3 核心价值

本产品不是单纯售卖配置文件，而是提供一套完整的产品化体验：
	•	可浏览和选择经过整理的 Personal Ops agents
	•	可通过 Preview Chat 快速了解 agent 的沟通风格与思路
	•	可将多个 agents 组合购买
	•	可在购买后通过统一的 Telegram 连接流程完成 Run 准备
	•	可在站内启动 Run，并查看状态、日志、结果
	•	可下载已购买的 install package
	•	可看到明确的风险标签与 bundle 风险摘要

1.4 Phase 1 业务假设

用户愿意为以下体验付费：
	•	购买多个适用于 Personal Ops 的 agent
	•	在购买后，通过一个简化的 Telegram 接入流程完成配置
	•	以一个统一的 Run 工作台方式运行多个 agent
	•	在站内查看进度、日志和结果，而不需要理解 OpenClaw、容器、provider 等底层细节

⸻

2. Phase 1 产品目标

2.1 产品目标

交付一个可运行的最小商业闭环，使用户可以完成如下流程：
	1.	浏览 agent
	2.	查看 agent 详情和风险信息
	3.	将多个 agent 加入购物车
	4.	完成支付购买
	5.	在购买后的 bundle 详情页完成 Telegram 配置
	6.	启动 Run
	7.	在站内查看 Run 的状态、日志和结果
	8.	下载已购买的 install package

2.2 成功标准

Phase 1 交付完成后，系统应支持：
	•	真实 agent catalog 与详情页
	•	真实 cart / checkout / order 流程
	•	真实 post-purchase Telegram setup 流程
	•	真实 Run 创建与 Run 查询流程
	•	站内 Run Status / Logs / Results UI
	•	风险标签与 bundle 风险展示
	•	购买后下载受控

⸻

3. 目标用户

3.1 主目标用户

个人知识工作者、技术倾向较强的早期用户、愿意尝试 agent workflow 的独立用户。

3.2 用户核心需求
	•	快速找到适合自己的 agent
	•	低门槛试用 agent 的思路和能力边界
	•	不需要自己安装和配置复杂环境
	•	不需要理解底层 provider 或 OpenClaw 的复杂配置
	•	通过一个统一界面完成购买、配置、启动与查看结果

⸻

4. 核心概念定义

4.1 Agent

一个可被购买、运行和下载的 Personal Ops agent 单元。每个 agent 有自己的用途说明、版本、风险标签和安装包。

4.2 Agent Version

一个 agent 的具体版本快照。版本包含其配置快照、安装包、变更记录以及对应的风险画像。

4.3 Preview Chat

用户在购买前进行的轻量预览交互，用于了解 agent 的思路、沟通方式与边界。Preview Chat 不使用真实 workspace、不执行工具、不访问文件、不访问网络。

4.4 Cart

用户当前选择购买的一组 agent。

4.5 Order / Purchased Bundle

用户支付完成后形成的购买记录。一个 order 包含多个已购买的 agents，是后续 Telegram 配置、Run 启动、下载访问的基础。

4.6 Run

购买后的一次运行实例。Run 会将本次 order 中的多个 agent 以及用户完成的 Telegram 配置注入到受管控环境中执行，并在站内提供状态、日志和结果。

4.7 Run-Level Telegram Setup

在 Phase 1 中，Telegram 配置是按 Run / 购买 bundle 维度统一配置的。一个已购买 bundle 默认使用一个 Telegram bot token 和一个 recipient pairing，应用于该次 Run 所包含的所有 agents。

4.8 Risk Badge

展示某个 agent 或 bundle 风险级别的产品化标签。

⸻

5. 信息架构与页面结构

5.1 页面清单

公共页面
	•	/：首页
	•	/agents：catalog
	•	/agents/:slug：agent detail
	•	/cart：购物车
	•	/checkout：结账页

登录后页面
	•	/app：Dashboard 首页
	•	/app/agents：已购买 bundles 列表
	•	/app/bundles/:orderId：已购买 bundle 详情页
	•	/app/runs：Run 历史列表
	•	/app/runs/:runId：Run 详情页

5.2 首页

首页需要完成以下信息传达：
	•	产品是什么
	•	产品的价值是什么
	•	支持的主要 Personal Ops 场景（Inbox / Calendar / Docs）
	•	Preview Chat 与 Run 的区别
	•	风险边界和受管运行价值
	•	进入 catalog 的主 CTA

5.3 Catalog 页面

每个 agent 卡片需要展示：
	•	agent 名称
	•	分类
	•	一句话 summary
	•	price
	•	Risk Badge
	•	Preview Chat CTA
	•	Add to Cart CTA

5.4 Agent Detail 页面

需要展示：
	•	agent 标题与 summary
	•	What this agent does
	•	What this agent does not do
	•	当前版本信息
	•	changelog 摘要
	•	风险标签与风险摘要
	•	Preview Chat 区域
	•	Add to Cart CTA
	•	购买后可获得的内容说明

5.5 Cart 页面

需要展示：
	•	已选中的 agents
	•	每个 agent 的风险标签
	•	bundle 风险摘要
	•	价格汇总
	•	remove 操作
	•	Checkout CTA

5.6 Checkout 页面

需要展示：
	•	订单摘要
	•	agents 列表
	•	bundle 风险摘要
	•	支付信息
	•	支付后的预期流程提示：购买后将进入 bundle 详情页完成 Telegram setup，并启动 Run

5.7 Dashboard 首页

需要展示：
	•	最近购买的 bundles
	•	最近 Runs
	•	快捷入口：继续配置、继续运行、查看结果

5.8 Purchased Bundle Detail 页面

这是购买后的核心页面。

页面需要展示：
	•	当前 order 的 agent 列表
	•	当前 bundle 风险摘要
	•	各 agent 当前版本
	•	Telegram setup wizard 或 setup 状态
	•	Run launch 区域
	•	下载 package 区域

5.9 Run Detail 页面

这是 Run 的主要工作台。

页面需要展示：
	•	Run 状态
	•	execution timeline / step list
	•	logs 列表
	•	results summary
	•	artifacts 下载列表
	•	rerun / retry 按钮（如支持）

⸻

6. 用户主流程

6.1 主路径
	1.	用户进入首页
	2.	浏览 catalog 或进入某个 agent detail
	3.	使用 Preview Chat 了解 agent
	4.	将一个或多个 agent 加入购物车
	5.	完成 checkout 与支付
	6.	跳转至 purchased bundle detail 页面
	7.	在页面内完成 Telegram setup
	8.	Telegram setup 完成后，点击 Run
	9.	系统创建 Run，并进入 Run detail 页面
	10.	用户查看 Run 状态、日志、结果
	11.	用户可下载 package 或结果 artifacts

⸻

7. Telegram Setup Wizard（Phase 1 关键能力）

7.1 产品目标

让用户在不理解 OpenClaw 配置细节的情况下，为已购买 bundle 完成统一 Telegram 接入。

7.2 配置模型

Phase 1 默认使用：
	•	一个购买 bundle 对应一个 Telegram bot token
	•	一个 recipient pairing
	•	应用于该 Run 的所有 agents

7.3 页面步骤

Step 1：Connect Telegram
输入项：
	•	Telegram Bot Token

动作：
	•	点击 Validate Bot Token
	•	后端验证 token
	•	验证成功后进入下一步

Step 2：Pair Telegram
页面展示说明：
	•	打开 Telegram
	•	找到该 bot
	•	向 bot 发送 /start

系统行为：
	•	后端启动 pairing 流程
	•	后端等待 Telegram webhook / worker 收到消息
	•	成功后更新 recipient pairing 状态

Step 3：Ready to Run
页面展示：
	•	Telegram Connected
	•	Pairing Completed
	•	当前配置将应用于本次 Run 的所有 agents
	•	Run 按钮解锁

7.4 交互要求
	•	默认路径不要求用户手动输入 Telegram ID
	•	默认路径不要求用户对每个 agent 分别填写 token
	•	UI 中始终明确这是 Run-level 共享配置

⸻

8. Run 产品体验

8.1 Run 启动条件

启动 Run 前必须满足：
	•	order 已支付成功
	•	Telegram bot token 已验证
	•	recipient pairing 已完成
	•	bundle 风险信息已可展示

8.2 Run 生命周期
	•	provisioning
	•	running
	•	completed
	•	failed

8.3 Run Detail 页面展示内容

A. Status
	•	当前状态
	•	startedAt
	•	updatedAt
	•	completedAt（如适用）
	•	runtime disclosure（usesRealWorkspace / usesTools / networkEnabled）

B. Logs
	•	时间戳
	•	level
	•	step
	•	message

C. Results
	•	运行摘要
	•	artifacts 列表
	•	结果文件下载入口

8.4 UX 规则
	•	Run 必须在站内完成体验
	•	用户不应看到 provider 名称、provider 页面、provider URL、provider ID
	•	Phase 1 不提供 remote desktop、live view、raw shell、terminal UI

⸻

9. Risk Layer

9.1 目标

在 agent 级、bundle 级、Run 级提供清晰且保守的风险展示。

9.2 Risk 展示层级

Agent Version 风险
每个 agent version 拥有一个 Risk Profile：
	•	risk level
	•	capability flags
	•	scan summary

Bundle 风险
购物车和已购买 bundle 需要展示：
	•	combinedRisk.level
	•	highest-risk-driver explanation

Run 风险
Run 页面需展示：
	•	当前 Run 的 combined risk
	•	runtime 风险相关 disclosure

9.3 风险规则

风险等级至少包含：
	•	low
	•	medium
	•	high

bundle 风险计算采用保守策略：
	•	只要任一 agent 为 high risk，则 bundle 不可显示为 low risk

9.4 用户可见输出
	•	Risk Badge
	•	bundle risk summary
	•	highest-risk-driver explanation
	•	与购买、Run 启动相关的风险展示

⸻

10. 数据模型

10.1 User

字段：
	•	id
	•	email
	•	name
	•	auth_provider
	•	created_at
	•	updated_at

10.2 Agent

字段：
	•	id
	•	slug
	•	title
	•	category
	•	summary
	•	description_markdown
	•	price_cents
	•	currency
	•	status
	•	current_version_id
	•	created_at
	•	updated_at

10.3 AgentVersion

字段：
	•	id
	•	agent_id
	•	version
	•	changelog_markdown
	•	preview_prompt_snapshot
	•	run_config_snapshot
	•	install_package_url
	•	install_script_markdown
	•	release_notes
	•	created_at

10.4 RiskProfile

字段：
	•	id
	•	agent_version_id
	•	chat_only
	•	read_files
	•	write_files
	•	network
	•	shell
	•	risk_level
	•	scan_summary
	•	created_at

10.5 Cart

字段：
	•	id
	•	user_id
	•	status
	•	created_at
	•	updated_at

10.6 CartItem

字段：
	•	id
	•	cart_id
	•	agent_id
	•	agent_version_id
	•	created_at

10.7 Order

字段：
	•	id
	•	user_id
	•	cart_id
	•	payment_provider
	•	payment_reference
	•	amount_cents
	•	currency
	•	status
	•	created_at
	•	updated_at
	•	paid_at

10.8 OrderItem

字段：
	•	id
	•	order_id
	•	agent_id
	•	agent_version_id
	•	price_cents
	•	created_at

10.9 RunChannelConfig

字段：
	•	id
	•	order_id
	•	channel_type (telegram)
	•	bot_token_secret_ref
	•	token_status (pending | validated | failed)
	•	recipient_binding_status (pending | paired | failed)
	•	recipient_external_id
	•	applies_to_scope (run)
	•	created_at
	•	updated_at

10.10 Run

字段：
	•	id
	•	user_id
	•	order_id
	•	channel_config_id
	•	status (provisioning | running | completed | failed)
	•	combined_risk_level (low | medium | high)
	•	uses_real_workspace
	•	uses_tools
	•	network_enabled
	•	provider_key_internal
	•	provider_run_ref_internal
	•	provider_state_json_internal
	•	result_summary
	•	result_artifacts_json
	•	transcript_json
	•	created_at
	•	started_at
	•	updated_at
	•	completed_at

⸻

11. 后端能力要求

11.1 Catalog 能力
	•	获取 agent 列表
	•	获取单个 agent 详情
	•	返回当前版本与风险信息

11.2 Cart 能力
	•	获取当前 cart
	•	添加 agent 到 cart
	•	从 cart 中删除 agent
	•	返回 bundle 风险摘要与价格汇总

11.3 Checkout / Order 能力
	•	创建 checkout session
	•	支付成功后生成 order 与 order items
	•	查询已购买 bundles
	•	查询单个 purchased bundle 详情

11.4 Telegram Setup 能力
	•	验证 Telegram bot token
	•	启动 pairing 流程
	•	查询 pairing 状态
	•	通过内部 webhook / worker 完成 pairing 状态更新

11.5 Run 能力
	•	创建 Run
	•	查询 Run 列表
	•	查询单个 Run 状态
	•	查询 Run logs
	•	查询 Run results

11.6 Download 能力
	•	针对已支付 order 提供 package 下载
	•	下载地址受控且签名

⸻

12. Run Provider 抽象设计要求

12.1 设计目标

后端应通过一个统一的 provider abstraction 连接底层 managed environment，以支持未来切换不同 provider，而不影响前端 contract。

12.2 抽象原则

采用面向接口的设计：
	•	orchestration 层依赖抽象，不依赖具体 provider SDK
	•	provider adapter 只负责 provider-specific execution
	•	前端与公开 API 只看到产品层的 Run 概念

12.3 统一接口职责

Run provider abstraction 至少要支持：
	•	run creation
	•	status retrieval
	•	log retrieval
	•	result retrieval
	•	stop / cleanup（如后续支持）

12.4 前端契约要求

前端 API 返回中不包含：
	•	provider 名称
	•	provider URL
	•	provider ID
	•	provider console link
	•	provider-specific terminology

⸻

13. OpenClaw 集成要求

13.1 Run 注入逻辑

在用户启动 Run 时，系统需要：
	•	读取当前 order 的 agent version snapshots
	•	构建本次 Run 的 agent bundle
	•	读取 RunChannelConfig
	•	将 Telegram channel 配置注入到受管 OpenClaw 环境
	•	启动 Run

13.2 配置原则
	•	Telegram 配置为 Run-level shared setup
	•	OpenClaw 配置由平台后端管理
	•	用户不需要直接编辑 OpenClaw 配置文件

⸻

14. API 合同

14.1 Public Endpoints
	•	GET /api/agents
	•	GET /api/agents/:slug
	•	POST /api/interviews/preview
	•	GET /api/cart
	•	POST /api/cart/items
	•	DELETE /api/cart/items/:cartItemId
	•	POST /api/checkout/session

14.2 Authenticated Endpoints
	•	GET /api/me/orders
	•	GET /api/me/orders/:orderId
	•	POST /api/me/orders/:orderId/run-channel/telegram/validate
	•	POST /api/me/orders/:orderId/run-channel/telegram/pairing/start
	•	GET /api/me/orders/:orderId/run-channel
	•	POST /api/me/orders/:orderId/runs
	•	GET /api/me/orders/:orderId/download
	•	GET /api/me/runs
	•	GET /api/me/runs/:runId
	•	GET /api/me/runs/:runId/logs
	•	GET /api/me/runs/:runId/result

14.3 Internal Endpoints / Internal Flows
	•	Telegram webhook / worker 处理 pairing completion
	•	payment completion / webhook handler
	•	internal scan endpoint for risk profile generation

⸻

15. 前端实现要求

15.1 技术要求

前端需支持：
	•	路由结构
	•	mock-first 到 real integration 的逐步升级
	•	loading / error / empty / success 状态
	•	响应式布局
	•	清晰的产品文案边界

15.2 状态管理要求

前端至少应管理：
	•	cart state
	•	purchased bundle detail state
	•	Telegram token validate state
	•	pairing state
	•	Run launch readiness
	•	Run status / logs / results state

15.3 页面组件要求

需要提供：
	•	Risk Badge 组件
	•	Bundle Risk Summary 组件
	•	Telegram Setup Wizard 组件
	•	Run Status Panel
	•	Run Logs Panel
	•	Run Results Panel

⸻

16. 风险实现要求

16.1 Deterministic Rules

Risk 层以确定性规则为主，不以模型拍脑袋判断为主。

16.2 Rule Categories

至少支持：
	•	dangerous command patterns
	•	suspicious encoded / obfuscated content
	•	network access requests
	•	shell execution requests
	•	file write requests
	•	sensitive credential handling

16.3 输出形式

每个 agent version 输出：
	•	risk level
	•	capability flags
	•	scan summary

每个 cart / order / run 输出：
	•	combined risk level
	•	bundle risk summary
	•	highest-risk-driver explanation

⸻

17. 运行与体验要求

17.1 Preview Chat
	•	prompt-only
	•	no real workspace
	•	no tools
	•	no files
	•	no network

17.2 Run
	•	post-purchase only
	•	requires Telegram setup completion before launch
	•	provider-agnostic
	•	in-product only
	•	no provider redirect
	•	no remote desktop / live view / raw shell in Phase 1

17.3 用户可见 Run 体验

用户只在产品内看到：
	•	Run Status
	•	Run Logs
	•	Run Results

⸻

18. 验收标准（Definition of Done）

Phase 1 交付完成的条件：

产品层
	•	用户可浏览、选择、购买多个 agents
	•	用户可在购买后进入 purchased bundle detail 页面
	•	用户可完成 Telegram setup
	•	用户可启动 Run

后端层
	•	订单与 entitlement 持久化正常
	•	下载受控
	•	Run 创建、查询、日志、结果接口可用
	•	Telegram pairing completion 由 documented backend-owned mechanism 处理

前端层
	•	Phase 1 页面均可访问
	•	Preview Chat 与 Run 边界清晰
	•	风险信息可见
	•	Telegram setup wizard 可用
	•	Run status / logs / results 可展示

Risk 层
	•	每个 agent version 有风险信息
	•	cart / order / run 可展示 bundle risk

Run 层
	•	Run 启动为 post-purchase only
	•	Run 在站内完成体验
	•	provider 保持 backend-internal

⸻

19. 实施阶段建议

阶段 1：后端基础设施
	•	schema / migration
	•	seed data
	•	catalog / cart / order / download 基础 endpoints

阶段 2：Telegram setup 与 Run
	•	Telegram token validate
	•	pairing flow
	•	Run creation / status / logs / result
	•	provider abstraction

阶段 3：前端集成
	•	public flow
	•	purchased bundle detail
	•	Telegram setup wizard
	•	Run detail UI

阶段 4：Trust Layer 与集成验证
	•	risk rules
	•	bundle risk aggregation
	•	end-to-end integration

⸻

20. 交付物清单

最终交付需要包含：
	•	前端应用
	•	后端服务
	•	数据库 schema 与 migration
	•	API contract 实现
	•	Telegram pairing backend flow
	•	Run provider abstraction
	•	风险规则与 risk 输出
	•	初始 agent seed data
	•	安装包下载控制
	•	基本验证脚本 / gate / typecheck / build 通过
