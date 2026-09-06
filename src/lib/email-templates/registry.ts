import type { ComponentType } from 'react'

export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string
}

import { template as transactionAlert } from './transaction-alert'
import { template as topupCredited } from './topup-credited'
import { template as welcome } from './welcome'
import { template as p2pOrderUpdate } from './p2p-order-update'
import { template as securityAlert } from './security-alert'
import { template as supportReply } from './support-reply'

/**
 * Template registry — maps template names to their React Email components.
 */
export const TEMPLATES: Record<string, TemplateEntry> = {
  'transaction-alert': transactionAlert,
  'topup-credited': topupCredited,
  welcome,
  'p2p-order-update': p2pOrderUpdate,
  'security-alert': securityAlert,
  'support-reply': supportReply,
}
