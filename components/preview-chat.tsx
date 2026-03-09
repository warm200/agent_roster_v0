'use client'

import { useEffect, useRef, useState } from 'react'
import type { Agent, PreviewMessage } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Send, Bot, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { sendPreviewInterview } from '@/services/preview.api'

interface PreviewChatProps {
  agent: Agent
}

const getInitialMessage = (agent: Agent): PreviewMessage => {
  return {
    role: 'assistant',
    content: `Hi! I'm ${agent.title}. ${agent.summary} Feel free to ask me how I work or what I can help you with. Remember, this is a preview only, so I can't access real data here.`,
  }
}

export function PreviewChat({ agent }: PreviewChatProps) {
  const [messages, setMessages] = useState<PreviewMessage[]>([getInitialMessage(agent)])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMessages([getInitialMessage(agent)])
    setInput('')
    setIsTyping(false)
  }, [agent.id, agent.summary, agent.title])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleSend = async () => {
    const message = input.trim()
    if (!message || isTyping) return

    const userMessage: PreviewMessage = { role: 'user', content: message }
    const nextMessages = [...messages, userMessage]
    setMessages(nextMessages)
    setInput('')
    setIsTyping(true)

    const typingDelayMs = 800 + Math.random() * 800

    try {
      const [response] = await Promise.all([
        sendPreviewInterview({
          slug: agent.slug,
          messages: nextMessages,
        }),
        new Promise((resolve) => setTimeout(resolve, typingDelayMs)),
      ])
      const assistantContent = response.reply

      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: assistantContent },
      ])
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            "I'm having trouble loading the preview response right now. Please try again in a moment.",
        },
      ])
    } finally {
      setIsTyping(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  return (
    <div className="flex max-h-[min(70vh,32rem)] min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-secondary/15">
      <div
        ref={scrollRef}
        aria-label="Preview conversation"
        className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 pr-3"
      >
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

      <div className="flex gap-2 border-t border-border bg-background/80 p-4 backdrop-blur">
        <Input
          placeholder="Ask about this agent..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isTyping}
          className="bg-secondary"
        />
        <Button
          size="icon"
          aria-label="Send preview message"
          onClick={() => void handleSend()}
          disabled={!input.trim() || isTyping}
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}
