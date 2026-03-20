'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { usePairingStatus } from '@/hooks/use-pairing-status'
import { disconnectTelegramChannel, startTelegramPairing, validateTelegramToken } from '@/services/telegram.api'
import type { RunChannelConfig } from '@/lib/types'
import { CheckCircle2, Send, ArrowRight, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

type Step = 'connect' | 'pair' | 'ready'

interface TelegramSetupWizardProps {
  orderId: string
  initialStatus?: {
    tokenStatus: 'pending' | 'validated' | 'failed'
    pairingStatus: 'pending' | 'paired' | 'failed'
    botUsername?: string
  }
  onChannelConfigChange?: (channelConfig: RunChannelConfig) => void
  onComplete?: () => void
}

export function TelegramSetupWizard({
  orderId,
  initialStatus,
  onChannelConfigChange,
  onComplete,
}: TelegramSetupWizardProps) {
  const [step, setStep] = useState<Step>(() => {
    if (initialStatus?.pairingStatus === 'paired') return 'ready'
    if (initialStatus?.tokenStatus === 'validated') return 'pair'
    return 'connect'
  })

  const [botToken, setBotToken] = useState('')
  const [botUsername, setBotUsername] = useState(initialStatus?.botUsername || '')
  const [isValidating, setIsValidating] = useState(false)
  const [isPairing, setIsPairing] = useState(false)
  const [isDisconnecting, setIsDisconnecting] = useState(false)
  const [pairingCommand, setPairingCommand] = useState<string | null>(null)
  const hasCompletedRef = useRef(false)
  const { channelConfig, error: pairingError, isPolling } = usePairingStatus(orderId, isPairing)

  useEffect(() => {
    setBotUsername(initialStatus?.botUsername || '')
  }, [initialStatus?.botUsername])

  useEffect(() => {
    if (channelConfig?.tokenStatus === 'validated') {
      setStep((currentStep) => (currentStep === 'connect' ? 'pair' : currentStep))
    }

    if (channelConfig) {
      onChannelConfigChange?.(channelConfig)
    }

    if (channelConfig?.recipientBindingStatus === 'paired') {
      setStep('ready')
      setIsPairing(false)

      if (!hasCompletedRef.current) {
        hasCompletedRef.current = true
        toast.success('Telegram paired successfully!')
        onComplete?.()
      }
    }

    if (channelConfig?.recipientBindingStatus === 'failed' && isPairing) {
      setIsPairing(false)
      toast.error('Telegram pairing failed. Please try again.')
    }
  }, [channelConfig, isPairing, onChannelConfigChange, onComplete])

  useEffect(() => {
    if (pairingError && step === 'pair') {
      toast.error(pairingError)
    }
  }, [pairingError, step])

  const handleValidateToken = async () => {
    if (!botToken.trim()) {
      toast.error('Please enter a bot token')
      return
    }

    setIsValidating(true)

    try {
      const payload = await validateTelegramToken(orderId, botToken)
      setBotUsername(payload.botUsername || 'YourAgentBot')
      setPairingCommand(null)
      setStep('pair')
      toast.success('Bot token validated!')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Network error while validating bot token')
    } finally {
      setIsValidating(false)
    }
  }

  const handleStartPairing = async () => {
    setIsPairing(true)
    let pairingStarted = false

    try {
      const payload = await startTelegramPairing(orderId)
      setBotUsername(payload.botUsername || botUsername || 'YourAgentBot')
      setPairingCommand(payload.pairingCommand || null)
      setStep('pair')
      pairingStarted = true
      toast.success('Pairing started. Send /start in Telegram to finish setup.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Network error while pairing Telegram')
    } finally {
      if (!pairingStarted) {
        setIsPairing(false)
      }
    }
  }

  const handleDisconnect = async () => {
    setIsDisconnecting(true)

    try {
      const payload = await disconnectTelegramChannel(orderId)
      setBotToken('')
      setBotUsername('')
      setPairingCommand(null)
      setIsPairing(false)
      hasCompletedRef.current = false
      setStep('connect')
      onChannelConfigChange?.(payload.channelConfig)
      toast.success('Telegram bot disconnected. You can connect a different bot now.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to disconnect Telegram bot')
    } finally {
      setIsDisconnecting(false)
    }
  }

  const canDisconnect =
    !isDisconnecting &&
    !isValidating &&
    !isPairing &&
    (channelConfig?.tokenStatus === 'validated' ||
      channelConfig?.recipientBindingStatus === 'paired' ||
      initialStatus?.tokenStatus === 'validated' ||
      initialStatus?.pairingStatus === 'paired')

  return (
    <div className="space-y-6">
      {/* Progress */}
      <div className="flex items-center justify-between">
        <StepIndicator
          number={1}
          label="Connect"
          status={step === 'connect' ? 'current' : step === 'pair' || step === 'ready' ? 'complete' : 'pending'}
        />
        <div className="flex-1 h-px bg-border mx-4" />
        <StepIndicator
          number={2}
          label="Pair"
          status={step === 'pair' ? 'current' : step === 'ready' ? 'complete' : 'pending'}
        />
        <div className="flex-1 h-px bg-border mx-4" />
        <StepIndicator
          number={3}
          label="Ready"
          status={step === 'ready' ? 'complete' : 'pending'}
        />
      </div>

      {/* Step Content */}
      {step === 'connect' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="w-5 h-5" />
              Connect Telegram Bot
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Create a Telegram bot using{' '}
              <a
                href="https://t.me/botfather"
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground underline"
              >
                @BotFather
              </a>{' '}
              and paste the bot token below.
            </p>

            <div className="space-y-2">
              <Label htmlFor="botToken">Bot Token</Label>
              <Input
                id="botToken"
                type="password"
                placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Your token is encrypted and never stored in plain text.
              </p>
            </div>
          </CardContent>
          <CardFooter>
            <Button onClick={handleValidateToken} disabled={isValidating || !botToken.trim()}>
              {isValidating ? (
                <>
                  <Spinner className="w-4 h-4 mr-2" />
                  Validating...
                </>
              ) : (
                <>
                  Validate Token
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      )}

      {step === 'pair' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="w-5 h-5" />
              Pair Your Telegram
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-secondary rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <span className="text-sm">
                Bot connected: <span className="font-mono font-medium">@{botUsername}</span>
              </span>
            </div>

            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Now, open Telegram and start a chat with your bot:
              </p>
              <p className="text-xs text-muted-foreground">
                Pairing finishes when Telegram sends the <code className="bg-secondary px-1 py-0.5 rounded">/start</code> event back to your configured webhook.
              </p>

              {pairingCommand && (
                <p className="text-sm text-muted-foreground">
                  Quick open:{' '}
                  <a
                    className="text-foreground underline"
                    href={pairingCommand}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {pairingCommand}
                  </a>
                </p>
              )}

              <ol className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-secondary flex items-center justify-center text-xs shrink-0">1</span>
                  <span>Open the quick-open link above, or find @{botUsername} in Telegram</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-secondary flex items-center justify-center text-xs shrink-0">2</span>
                  <span>Tap <code className="bg-secondary px-1.5 py-0.5 rounded">Start</code> in Telegram</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-secondary flex items-center justify-center text-xs shrink-0">3</span>
                  <span>Wait for confirmation below</span>
                </li>
              </ol>
            </div>

            {(isPairing || isPolling) && (
              <div className="flex items-center gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <Spinner className="w-5 h-5 text-amber-400" />
                <span className="text-sm text-amber-400">Waiting for Telegram to deliver your /start webhook confirmation...</span>
              </div>
            )}
          </CardContent>
          <CardFooter>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button onClick={handleStartPairing} disabled={isPairing || isPolling || isDisconnecting}>
                {isPairing || isPolling ? (
                  <>
                    <Spinner className="w-4 h-4 mr-2" />
                    Waiting for webhook...
                  </>
                ) : (
                  <>
                    Start Pairing
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={handleDisconnect}
                disabled={!canDisconnect}
              >
                {isDisconnecting ? (
                  <>
                    <Spinner className="w-4 h-4 mr-2" />
                    Disconnecting...
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4 mr-2" />
                    Disconnect Bot
                  </>
                )}
              </Button>
            </div>
          </CardFooter>
        </Card>
      )}

      {step === 'ready' && (
        <Card className="border-emerald-500/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
              Telegram Connected
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Your Telegram is connected and ready. You will receive notifications and results from your agent runs in your Telegram chat.
            </p>

            <div className="flex items-center gap-3 p-3 bg-secondary rounded-lg">
              <Send className="w-5 h-5" />
              <span className="text-sm font-mono">@{botUsername || 'YourAgentBot'}</span>
              <span className="text-xs text-emerald-400 ml-auto">Connected</span>
            </div>

            <div className="text-sm text-muted-foreground">
              <p>This configuration applies to all agents in this bundle.</p>
            </div>
          </CardContent>
          <CardFooter>
            <Button variant="outline" onClick={handleDisconnect} disabled={!canDisconnect}>
              {isDisconnecting ? (
                <>
                  <Spinner className="w-4 h-4 mr-2" />
                  Disconnecting...
                </>
              ) : (
                <>
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Connect Different Bot
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  )
}

function StepIndicator({
  number,
  label,
  status
}: {
  number: number
  label: string
  status: 'pending' | 'current' | 'complete'
}) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium',
          status === 'complete' && 'bg-emerald-500 text-white',
          status === 'current' && 'bg-foreground text-background',
          status === 'pending' && 'bg-secondary text-muted-foreground'
        )}
      >
        {status === 'complete' ? <CheckCircle2 className="w-4 h-4" /> : number}
      </div>
      <span className={cn(
        'text-sm hidden sm:inline',
        status === 'current' && 'font-medium text-foreground',
        status !== 'current' && 'text-muted-foreground'
      )}>
        {label}
      </span>
    </div>
  )
}
