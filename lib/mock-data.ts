import type { Agent, Cart, Order, Run, RunLog, BundleRisk, RiskLevel } from './types'

// Helper to create timestamps
const now = new Date().toISOString()
const yesterday = new Date(Date.now() - 86400000).toISOString()
const lastWeek = new Date(Date.now() - 7 * 86400000).toISOString()

// Mock Agents
export const mockAgents: Agent[] = [
  {
    id: 'agent-1',
    slug: 'inbox-triage',
    title: 'Inbox Triage Agent',
    category: 'inbox',
    summary: 'Automatically categorize and prioritize your emails based on urgency and context.',
    descriptionMarkdown: `## What this agent does

This agent connects to your email inbox and helps you stay on top of your messages by:

- **Categorizing** incoming emails into actionable buckets (urgent, follow-up, FYI, spam)
- **Prioritizing** based on sender importance and content analysis
- **Summarizing** long email threads so you can catch up quickly
- **Drafting** quick replies for routine messages

## What this agent does NOT do

- It does not send emails on your behalf without explicit approval
- It does not delete or archive emails automatically
- It does not access attachments or download files
- It does not share your email content with third parties`,
    priceCents: 0,
    currency: 'USD',
    status: 'active',
    currentVersion: {
      id: 'ver-1',
      agentId: 'agent-1',
      version: '1.2.0',
      changelogMarkdown: '- Improved categorization accuracy\n- Added thread summarization\n- Fixed timezone handling',
      previewPromptSnapshot: 'You are an email triage assistant. Help users understand how you would categorize and prioritize their emails.',
      runConfigSnapshot: '{}',
      installPackageUrl: '/downloads/inbox-triage-1.2.0.zip',
      installScriptMarkdown: '```bash\nunzip inbox-triage-1.2.0.zip\ncd inbox-triage\nnpm install\n```',
      releaseNotes: 'This release focuses on improved accuracy and new summarization features.',
      riskProfile: {
        id: 'risk-1',
        agentVersionId: 'ver-1',
        chatOnly: false,
        readFiles: false,
        writeFiles: false,
        network: true,
        shell: false,
        riskLevel: 'low',
        scanSummary: 'Network access for email API only. No file system or shell access.',
        createdAt: now,
      },
      createdAt: lastWeek,
    },
    createdAt: lastWeek,
    updatedAt: now,
  },
  {
    id: 'agent-2',
    slug: 'calendar-optimizer',
    title: 'Calendar Optimizer',
    category: 'calendar',
    summary: 'Smart scheduling assistant that finds optimal meeting times and protects your focus time.',
    descriptionMarkdown: `## What this agent does

This agent integrates with your calendar to optimize your schedule:

- **Finds** optimal meeting times based on your preferences and attendee availability
- **Protects** focus blocks by suggesting meeting-free time slots
- **Reschedules** conflicts intelligently with minimal disruption
- **Sends** calendar invites and reminders via Telegram

## What this agent does NOT do

- It does not access your email or other communication channels
- It does not make travel arrangements
- It does not access your files or documents
- It cannot override your manual calendar edits`,
    priceCents: 0,
    currency: 'USD',
    status: 'active',
    currentVersion: {
      id: 'ver-2',
      agentId: 'agent-2',
      version: '2.0.1',
      changelogMarkdown: '- Added focus time protection\n- Improved conflict resolution\n- Better timezone support',
      previewPromptSnapshot: 'You are a calendar optimization assistant. Help users understand how you would optimize their schedule.',
      runConfigSnapshot: '{}',
      installPackageUrl: '/downloads/calendar-optimizer-2.0.1.zip',
      installScriptMarkdown: '```bash\nunzip calendar-optimizer-2.0.1.zip\ncd calendar-optimizer\nnpm install\n```',
      releaseNotes: 'Major update with focus time protection features.',
      riskProfile: {
        id: 'risk-2',
        agentVersionId: 'ver-2',
        chatOnly: false,
        readFiles: false,
        writeFiles: false,
        network: true,
        shell: false,
        riskLevel: 'low',
        scanSummary: 'Network access for calendar API only. No file system or shell access.',
        createdAt: now,
      },
      createdAt: lastWeek,
    },
    createdAt: lastWeek,
    updatedAt: now,
  },
  {
    id: 'agent-3',
    slug: 'docs-summarizer',
    title: 'Docs Summarizer Pro',
    category: 'docs',
    summary: 'Automatically summarize documents, extract key points, and generate briefs.',
    descriptionMarkdown: `## What this agent does

This agent processes your documents to save you reading time:

- **Summarizes** long documents into digestible briefs
- **Extracts** key points, action items, and deadlines
- **Generates** executive summaries for reports
- **Creates** comparison tables for multiple documents

## What this agent does NOT do

- It does not edit or modify your original documents
- It does not share document content externally
- It does not store documents after processing
- It cannot process encrypted or password-protected files`,
    priceCents: 0,
    currency: 'USD',
    status: 'active',
    currentVersion: {
      id: 'ver-3',
      agentId: 'agent-3',
      version: '1.5.0',
      changelogMarkdown: '- Added comparison tables\n- Improved extraction accuracy\n- Support for more file formats',
      previewPromptSnapshot: 'You are a document summarization assistant. Help users understand how you would summarize their documents.',
      runConfigSnapshot: '{}',
      installPackageUrl: '/downloads/docs-summarizer-1.5.0.zip',
      installScriptMarkdown: '```bash\nunzip docs-summarizer-1.5.0.zip\ncd docs-summarizer\nnpm install\n```',
      releaseNotes: 'New comparison table feature and format support.',
      riskProfile: {
        id: 'risk-3',
        agentVersionId: 'ver-3',
        chatOnly: false,
        readFiles: true,
        writeFiles: false,
        network: true,
        shell: false,
        riskLevel: 'medium',
        scanSummary: 'Requires file read access for document processing. Network access for API calls.',
        createdAt: now,
      },
      createdAt: lastWeek,
    },
    createdAt: lastWeek,
    updatedAt: now,
  },
  {
    id: 'agent-4',
    slug: 'workflow-automator',
    title: 'Workflow Automator',
    category: 'automation',
    summary: 'Create and run custom automation workflows across your tools and services.',
    descriptionMarkdown: `## What this agent does

This agent enables powerful cross-tool automation:

- **Connects** multiple services via APIs
- **Triggers** actions based on events across platforms
- **Transforms** data between different formats
- **Logs** all operations for audit and debugging

## What this agent does NOT do

- It cannot access services without explicit API credentials
- It does not store your API keys permanently
- It cannot perform actions outside defined workflows
- It does not have direct database access`,
    priceCents: 0,
    currency: 'USD',
    status: 'active',
    currentVersion: {
      id: 'ver-4',
      agentId: 'agent-4',
      version: '3.1.0',
      changelogMarkdown: '- Added webhook triggers\n- Improved error handling\n- New transformation functions',
      previewPromptSnapshot: 'You are a workflow automation assistant. Help users understand how you would automate their workflows.',
      runConfigSnapshot: '{}',
      installPackageUrl: '/downloads/workflow-automator-3.1.0.zip',
      installScriptMarkdown: '```bash\nunzip workflow-automator-3.1.0.zip\ncd workflow-automator\nnpm install\n```',
      releaseNotes: 'Major improvements to reliability and new webhook support.',
      riskProfile: {
        id: 'risk-4',
        agentVersionId: 'ver-4',
        chatOnly: false,
        readFiles: true,
        writeFiles: true,
        network: true,
        shell: true,
        riskLevel: 'high',
        scanSummary: 'Full access required for automation. Shell execution enabled for scripts. All operations logged.',
        createdAt: now,
      },
      createdAt: lastWeek,
    },
    createdAt: lastWeek,
    updatedAt: now,
  },
  {
    id: 'agent-5',
    slug: 'analytics-dashboard',
    title: 'Personal Analytics Dashboard',
    category: 'analytics',
    summary: 'Track your productivity metrics and generate insights from your digital activity.',
    descriptionMarkdown: `## What this agent does

This agent provides personal productivity analytics:

- **Tracks** time spent across applications and websites
- **Analyzes** patterns in your work habits
- **Generates** weekly productivity reports
- **Suggests** optimization opportunities

## What this agent does NOT do

- It does not share your data with third parties
- It does not record screen content or keystrokes
- It does not access financial or sensitive accounts
- It cannot modify your system settings`,
    priceCents: 0,
    currency: 'USD',
    status: 'active',
    currentVersion: {
      id: 'ver-5',
      agentId: 'agent-5',
      version: '1.0.2',
      changelogMarkdown: '- Fixed memory leak\n- Improved chart rendering\n- Added dark mode',
      previewPromptSnapshot: 'You are a productivity analytics assistant. Help users understand their work patterns.',
      runConfigSnapshot: '{}',
      installPackageUrl: '/downloads/analytics-dashboard-1.0.2.zip',
      installScriptMarkdown: '```bash\nunzip analytics-dashboard-1.0.2.zip\ncd analytics-dashboard\nnpm install\n```',
      releaseNotes: 'Bug fixes and UI improvements.',
      riskProfile: {
        id: 'risk-5',
        agentVersionId: 'ver-5',
        chatOnly: false,
        readFiles: true,
        writeFiles: false,
        network: false,
        shell: false,
        riskLevel: 'low',
        scanSummary: 'Read-only file access for activity logs. No network or shell access.',
        createdAt: now,
      },
      createdAt: lastWeek,
    },
    createdAt: lastWeek,
    updatedAt: now,
  },
]

// Calculate bundle risk from items
export function calculateBundleRisk(agents: Agent[]): BundleRisk {
  if (agents.length === 0) {
    return { level: 'low', highestRiskDriver: null, summary: 'No agents selected' }
  }

  const riskOrder: RiskLevel[] = ['low', 'medium', 'high']
  let maxRisk: RiskLevel = 'low'
  let driver: string | null = null

  for (const agent of agents) {
    const agentRisk = agent.currentVersion.riskProfile.riskLevel
    if (riskOrder.indexOf(agentRisk) > riskOrder.indexOf(maxRisk)) {
      maxRisk = agentRisk
      driver = agent.title
    }
  }

  const summaries: Record<RiskLevel, string> = {
    low: 'This bundle has minimal risk. All agents operate with limited permissions.',
    medium: 'This bundle has moderate risk. Some agents require file read access.',
    high: 'This bundle has elevated risk. Includes agents with shell or write access. Review carefully.',
  }

  return {
    level: maxRisk,
    highestRiskDriver: driver,
    summary: summaries[maxRisk],
  }
}

// Mock Cart
export const mockCart: Cart = {
  id: 'cart-1',
  userId: null,
  status: 'active',
  items: [],
  bundleRisk: { level: 'low', highestRiskDriver: null, summary: 'No agents selected' },
  totalCents: 0,
  currency: 'USD',
  createdAt: now,
  updatedAt: now,
}

// Mock Orders
export const mockOrders: Order[] = [
  {
    id: 'order-1',
    userId: 'user-1',
    cartId: 'cart-old-1',
    paymentProvider: 'stripe',
    paymentReference: 'pi_1234567890',
    amountCents: 6800,
    currency: 'USD',
    status: 'paid',
    items: [
      {
        id: 'oi-1',
        orderId: 'order-1',
        agent: mockAgents[0],
        agentVersion: mockAgents[0].currentVersion,
        priceCents: 2900,
        createdAt: yesterday,
      },
      {
        id: 'oi-2',
        orderId: 'order-1',
        agent: mockAgents[1],
        agentVersion: mockAgents[1].currentVersion,
        priceCents: 3900,
        createdAt: yesterday,
      },
    ],
    channelConfig: {
      id: 'channel-1',
      orderId: 'order-1',
      channelType: 'telegram',
      botTokenSecretRef: 'encrypted:abc123',
      tokenStatus: 'validated',
      recipientBindingStatus: 'paired',
      recipientExternalId: '123456789',
      appliesToScope: 'run',
      createdAt: yesterday,
      updatedAt: now,
    },
    bundleRisk: calculateBundleRisk([mockAgents[0], mockAgents[1]]),
    createdAt: yesterday,
    updatedAt: now,
    paidAt: yesterday,
  },
]

// Mock Runs
export const mockRuns: Run[] = [
  {
    id: 'run-1',
    userId: 'user-1',
    orderId: 'order-1',
    channelConfigId: 'channel-1',
    status: 'completed',
    combinedRiskLevel: 'low',
    usesRealWorkspace: true,
    usesTools: true,
    networkEnabled: true,
    resultSummary: 'Successfully processed 47 emails and optimized 12 calendar events.',
    resultArtifacts: [
      {
        id: 'artifact-1',
        name: 'email-report.pdf',
        type: 'application/pdf',
        size: 245000,
        downloadUrl: '/downloads/run-1/email-report.pdf',
      },
      {
        id: 'artifact-2',
        name: 'calendar-changes.json',
        type: 'application/json',
        size: 12400,
        downloadUrl: '/downloads/run-1/calendar-changes.json',
      },
    ],
    createdAt: yesterday,
    startedAt: yesterday,
    updatedAt: now,
    completedAt: now,
  },
  {
    id: 'run-2',
    userId: 'user-1',
    orderId: 'order-1',
    channelConfigId: 'channel-1',
    status: 'running',
    combinedRiskLevel: 'low',
    usesRealWorkspace: true,
    usesTools: true,
    networkEnabled: true,
    resultSummary: null,
    resultArtifacts: [],
    createdAt: now,
    startedAt: now,
    updatedAt: now,
    completedAt: null,
  },
  {
    id: 'run-3',
    userId: 'user-1',
    orderId: 'order-1',
    channelConfigId: 'channel-1',
    status: 'failed',
    combinedRiskLevel: 'low',
    usesRealWorkspace: true,
    usesTools: true,
    networkEnabled: true,
    resultSummary: 'Run stopped after the calendar API returned a temporary authorization error.',
    resultArtifacts: [],
    createdAt: lastWeek,
    startedAt: lastWeek,
    updatedAt: yesterday,
    completedAt: yesterday,
  },
]

// Mock Run Logs
export const mockRunLogs: Record<string, RunLog[]> = {
  'run-1': [
    { timestamp: yesterday, level: 'info', step: 'init', message: 'Initializing run environment' },
    { timestamp: yesterday, level: 'info', step: 'connect', message: 'Connecting to email service' },
    { timestamp: yesterday, level: 'info', step: 'process', message: 'Processing inbox: 47 emails found' },
    { timestamp: yesterday, level: 'info', step: 'categorize', message: 'Categorized: 12 urgent, 20 follow-up, 10 FYI, 5 spam' },
    { timestamp: yesterday, level: 'info', step: 'calendar', message: 'Connecting to calendar service' },
    { timestamp: yesterday, level: 'info', step: 'optimize', message: 'Found 12 scheduling opportunities' },
    { timestamp: yesterday, level: 'info', step: 'complete', message: 'Run completed successfully' },
  ],
  'run-2': [
    { timestamp: now, level: 'info', step: 'init', message: 'Provisioning managed workspace and loading bundle configuration' },
    { timestamp: now, level: 'info', step: 'inbox', message: 'Scanning inbox for new priority messages' },
    { timestamp: now, level: 'debug', step: 'calendar', message: 'Comparing calendar conflicts against focus-time rules' },
  ],
  'run-3': [
    { timestamp: lastWeek, level: 'info', step: 'init', message: 'Run started with shared Telegram channel config' },
    { timestamp: lastWeek, level: 'info', step: 'calendar', message: 'Attempting to open calendar provider session' },
    { timestamp: yesterday, level: 'error', step: 'calendar', message: 'Authorization expired while requesting calendar availability' },
    { timestamp: yesterday, level: 'warn', step: 'teardown', message: 'Run terminated before any artifacts were produced' },
  ],
}

// Get agent by slug
export function getAgentBySlug(slug: string): Agent | undefined {
  return mockAgents.find((a) => a.slug === slug)
}

// Get agents by category
export function getAgentsByCategory(category: string | null): Agent[] {
  if (!category) return mockAgents.filter((a) => a.status === 'active')
  return mockAgents.filter((a) => a.category === category && a.status === 'active')
}

// Format price
export function formatPrice(cents: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(cents / 100)
}
