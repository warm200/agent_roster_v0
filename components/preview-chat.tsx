'use client'

import { Fragment, useEffect, useRef, useState } from 'react'
import type { Agent, PreviewMessage } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Send, Bot, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { sendPreviewInterview } from '@/services/preview.api'

interface PreviewChatProps {
  agent: Agent
  userAvatarUrl?: string | null
  userName?: string | null
}

type PreviewBlock =
  | { kind: 'code'; language: string | null; value: string }
  | { kind: 'heading'; level: 1 | 2 | 3; value: string }
  | { kind: 'ordered-list'; items: string[] }
  | { kind: 'paragraph'; value: string }
  | { kind: 'unordered-list'; items: string[] }

const getInitialMessage = (agent: Agent): PreviewMessage => {
  return {
    role: 'assistant',
    content: `Hi! I'm ${agent.title}. ${agent.summary} Feel free to ask me how I work or what I can help you with. Remember, this is a preview only, so I can't access real data here.`,
  }
}

function getInitials(name: string | null | undefined) {
  return (
    name
      ?.split(' ')
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'YU'
  )
}

function renderInlineMarkdown(text: string) {
  const tokens = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).filter(Boolean)

  return tokens.map((token, index) => {
    if (token.startsWith('**') && token.endsWith('**')) {
      return <strong key={`${token}-${index}`}>{token.slice(2, -2)}</strong>
    }

    if (token.startsWith('`') && token.endsWith('`')) {
      return (
        <code
          key={`${token}-${index}`}
          className="rounded bg-black/25 px-1.5 py-0.5 font-mono text-[0.92em]"
        >
          {token.slice(1, -1)}
        </code>
      )
    }

    return <Fragment key={`${token}-${index}`}>{token}</Fragment>
  })
}

function parsePreviewMarkdown(content: string): PreviewBlock[] {
  const lines = content.replace(/\r\n/g, '\n').split('\n')
  const blocks: PreviewBlock[] = []
  let paragraphLines: string[] = []
  let listItems: string[] = []
  let listKind: 'ordered-list' | 'unordered-list' | null = null
  let codeLines: string[] = []
  let codeLanguage: string | null = null
  let inCodeBlock = false

  const flushParagraph = () => {
    if (paragraphLines.length === 0) {
      return
    }

    blocks.push({
      kind: 'paragraph',
      value: paragraphLines.join(' ').trim(),
    })
    paragraphLines = []
  }

  const flushList = () => {
    if (!listKind || listItems.length === 0) {
      return
    }

    blocks.push({
      items: listItems,
      kind: listKind,
    })
    listItems = []
    listKind = null
  }

  const flushCodeBlock = () => {
    blocks.push({
      kind: 'code',
      language: codeLanguage,
      value: codeLines.join('\n').trimEnd(),
    })
    codeLines = []
    codeLanguage = null
    inCodeBlock = false
  }

  for (const line of lines) {
    const trimmed = line.trim()

    if (trimmed.startsWith('```')) {
      flushParagraph()
      flushList()

      if (inCodeBlock) {
        flushCodeBlock()
      } else {
        inCodeBlock = true
        codeLanguage = trimmed.slice(3).trim() || null
      }
      continue
    }

    if (inCodeBlock) {
      codeLines.push(line)
      continue
    }

    if (!trimmed) {
      flushParagraph()
      flushList()
      continue
    }

    const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/)
    if (headingMatch) {
      flushParagraph()
      flushList()
      blocks.push({
        kind: 'heading',
        level: headingMatch[1].length as 1 | 2 | 3,
        value: headingMatch[2],
      })
      continue
    }

    const unorderedMatch = trimmed.match(/^[-*]\s+(.+)$/)
    if (unorderedMatch) {
      flushParagraph()
      if (listKind && listKind !== 'unordered-list') {
        flushList()
      }
      listKind = 'unordered-list'
      listItems.push(unorderedMatch[1])
      continue
    }

    const orderedMatch = trimmed.match(/^\d+\.\s+(.+)$/)
    if (orderedMatch) {
      flushParagraph()
      if (listKind && listKind !== 'ordered-list') {
        flushList()
      }
      listKind = 'ordered-list'
      listItems.push(orderedMatch[1])
      continue
    }

    if (listKind) {
      flushList()
    }

    paragraphLines.push(trimmed)
  }

  if (inCodeBlock) {
    flushCodeBlock()
  }

  flushParagraph()
  flushList()

  return blocks
}

export function PreviewMessageBody({ content }: { content: string }) {
  const blocks = parsePreviewMarkdown(content)

  return (
    <div className="space-y-3 leading-6">
      {blocks.map((block, index) => {
        if (block.kind === 'heading') {
          const className = {
            1: 'text-base font-semibold',
            2: 'text-sm font-semibold',
            3: 'text-sm font-medium',
          }[block.level]

          return (
            <div key={`heading-${index}`} className={className}>
              {renderInlineMarkdown(block.value)}
            </div>
          )
        }

        if (block.kind === 'unordered-list') {
          return (
            <ul key={`ul-${index}`} className="list-disc space-y-1 pl-5">
              {block.items.map((item, itemIndex) => (
                <li key={`${item}-${itemIndex}`}>{renderInlineMarkdown(item)}</li>
              ))}
            </ul>
          )
        }

        if (block.kind === 'ordered-list') {
          return (
            <ol key={`ol-${index}`} className="list-decimal space-y-1 pl-5">
              {block.items.map((item, itemIndex) => (
                <li key={`${item}-${itemIndex}`}>{renderInlineMarkdown(item)}</li>
              ))}
            </ol>
          )
        }

        if (block.kind === 'code') {
          return (
            <pre
              key={`code-${index}`}
              className="overflow-x-auto rounded-lg border border-border/70 bg-black/30 p-3 font-mono text-xs"
            >
              <code>{block.value}</code>
            </pre>
          )
        }

        return (
          <p key={`p-${index}`} className="whitespace-normal">
            {renderInlineMarkdown(block.value)}
          </p>
        )
      })}
    </div>
  )
}

export function PreviewChat({ agent, userAvatarUrl, userName }: PreviewChatProps) {
  const [messages, setMessages] = useState<PreviewMessage[]>([getInitialMessage(agent)])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const resolvedUserName = userName || 'You'
  const userInitials = getInitials(userName)

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
              <Avatar
                className={cn(
                  'h-8 w-8 shrink-0 border',
                  msg.role === 'user'
                    ? 'border-foreground/20'
                    : 'rounded-lg border-border/70 bg-secondary'
                )}
              >
                {msg.role === 'user' ? (
                  <>
                    <AvatarImage alt={resolvedUserName} src={userAvatarUrl ?? undefined} />
                    <AvatarFallback className="bg-foreground text-background">
                      {userAvatarUrl ? userInitials : <User className="h-4 w-4" />}
                    </AvatarFallback>
                  </>
                ) : (
                  <>
                    <AvatarImage
                      alt={agent.title}
                      className="object-contain"
                      src={agent.thumbnailUrl ?? undefined}
                    />
                    <AvatarFallback className="rounded-lg bg-secondary text-foreground">
                      <Bot className="h-4 w-4" />
                    </AvatarFallback>
                  </>
                )}
              </Avatar>
              <div
                className={cn(
                  'max-w-[80%] rounded-lg px-4 py-3 text-sm',
                  msg.role === 'user'
                    ? 'bg-foreground text-background'
                    : 'bg-secondary text-foreground'
                )}
              >
                <PreviewMessageBody content={msg.content} />
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex gap-3">
              <Avatar className="h-8 w-8 rounded-lg border border-border/70 bg-secondary">
                <AvatarImage
                  alt={agent.title}
                  className="object-contain"
                  src={agent.thumbnailUrl ?? undefined}
                />
                <AvatarFallback className="rounded-lg bg-secondary text-foreground">
                  <Bot className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
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
