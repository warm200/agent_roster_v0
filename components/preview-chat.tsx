'use client'

import { useState, useRef, useEffect } from 'react'
import type { Agent, PreviewMessage } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Send, Bot, User } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PreviewChatProps {
  agent: Agent
}

// Simulated responses based on agent type
const getAgentResponse = (agent: Agent, message: string): string => {
  const lower = message.toLowerCase()

  if (agent.category === 'inbox') {
    if (lower.includes('how') || lower.includes('work')) {
      return "I analyze incoming emails and categorize them into four buckets: Urgent (needs immediate attention), Follow-up (requires action within 24-48 hours), FYI (informational, no action needed), and Spam. I look at sender importance, subject line keywords, and content to make these decisions."
    }
    if (lower.includes('priorit')) {
      return "I prioritize based on several factors: sender relationship (VIPs, direct reports, managers), urgency indicators in the subject, deadlines mentioned in the email body, and your historical response patterns. High-priority emails get flagged immediately."
    }
    if (lower.includes('summar')) {
      return "For long threads, I extract the key points: who said what, what decisions were made, what actions are pending, and any deadlines mentioned. You get a 2-3 sentence summary so you can catch up quickly."
    }
    return "I help manage your inbox by categorizing, prioritizing, and summarizing emails. What specific aspect would you like to know more about?"
  }

  if (agent.category === 'calendar') {
    if (lower.includes('focus') || lower.includes('protect')) {
      return "I analyze your calendar patterns to identify optimal focus time blocks. I'll suggest blocking 2-3 hour chunks in the morning when you're typically most productive, and I'll decline or reschedule meeting requests that would fragment these blocks."
    }
    if (lower.includes('conflict') || lower.includes('reschedule')) {
      return "When conflicts arise, I evaluate meeting importance, attendee availability, and your preferences. I'll suggest alternative times that work for all parties, minimizing back-and-forth. I never reschedule without your approval."
    }
    return "I optimize your calendar by protecting focus time and resolving scheduling conflicts. What would you like to know more about?"
  }

  if (agent.category === 'docs') {
    if (lower.includes('summar')) {
      return "I process documents in chunks, extracting key information: main arguments, supporting data, action items, and conclusions. For a 20-page report, I can produce a 1-page executive summary highlighting what matters most."
    }
    if (lower.includes('extract') || lower.includes('key point')) {
      return "I identify action items (tasks assigned to specific people), deadlines, decisions made, and open questions. These are formatted as a structured list you can immediately act on."
    }
    return "I summarize documents and extract key information. What type of documents are you working with?"
  }

  if (agent.category === 'automation') {
    if (lower.includes('workflow') || lower.includes('automate')) {
      return "I can connect multiple services via their APIs. For example: when a new email arrives matching certain criteria, extract data, update a spreadsheet, and notify your team via Slack. All configured through simple rules."
    }
    return "I automate workflows across your tools and services. What processes are you looking to automate?"
  }

  if (agent.category === 'analytics') {
    if (lower.includes('track') || lower.includes('metric')) {
      return "I track time spent in different applications, meeting frequency and duration, focus time vs. fragmented time, and communication patterns. All data stays local—nothing is shared externally."
    }
    return "I provide insights into your productivity patterns. What metrics are you most interested in?"
  }

  return `As ${agent.title}, I can help you with ${agent.category}-related tasks. Could you be more specific about what you'd like to know?`
}

export function PreviewChat({ agent }: PreviewChatProps) {
  const [messages, setMessages] = useState<PreviewMessage[]>([
    {
      role: 'assistant',
      content: `Hi! I'm ${agent.title}. ${agent.summary} Feel free to ask me how I work or what I can help you with. Remember, this is a preview—I can't access real data here.`,
    },
  ])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleSend = () => {
    if (!input.trim()) return

    const userMessage: PreviewMessage = { role: 'user', content: input }
    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsTyping(true)

    // Simulate typing delay
    setTimeout(() => {
      const response = getAgentResponse(agent, input)
      setMessages((prev) => [...prev, { role: 'assistant', content: response }])
      setIsTyping(false)
    }, 800 + Math.random() * 800)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-col h-96">
      <ScrollArea className="flex-1 pr-4" ref={scrollRef}>
        <div className="space-y-4">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={cn(
                'flex gap-3',
                msg.role === 'user' ? 'flex-row-reverse' : ''
              )}
            >
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center shrink-0',
                  msg.role === 'user' ? 'bg-foreground' : 'bg-secondary'
                )}
              >
                {msg.role === 'user' ? (
                  <User className="w-4 h-4 text-background" />
                ) : (
                  <Bot className="w-4 h-4 text-foreground" />
                )}
              </div>
              <div
                className={cn(
                  'rounded-lg px-4 py-3 max-w-[80%] text-sm',
                  msg.role === 'user'
                    ? 'bg-foreground text-background'
                    : 'bg-secondary text-foreground'
                )}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                <Bot className="w-4 h-4 text-foreground" />
              </div>
              <div className="bg-secondary rounded-lg px-4 py-3">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="flex gap-2 mt-4 pt-4 border-t border-border">
        <Input
          placeholder="Ask about this agent..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isTyping}
          className="bg-secondary"
        />
        <Button size="icon" onClick={handleSend} disabled={!input.trim() || isTyping}>
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}
