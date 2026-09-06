import * as React from 'react'
import { Text } from '@react-email/components'

import type { TemplateEntry } from './registry'
import { BRAND, BrandEmail, DetailRows, amount, text } from './brand'

interface P2pOrderUpdateProps {
  title?: string
  statusLabel?: string
  amountLabel?: string
  orderRef?: string | null
  counterparty?: string | null
  message?: string
  actionUrl?: string
}

const Email = ({
  title = 'P2P order update',
  statusLabel = '',
  amountLabel = '',
  orderRef = null,
  counterparty = null,
  message = '',
  actionUrl = `${BRAND.url}/p2p`,
}: P2pOrderUpdateProps) => (
  <BrandEmail
    preview={`${title}${orderRef ? ` · ${orderRef}` : ''}`}
    heading={title}
    ctaLabel="Open trade room"
    ctaUrl={actionUrl}
    footerNote="Escrow protects both sides until the trade completes."
  >
    {amountLabel ? <Text style={amount}>{amountLabel}</Text> : null}
    {message ? <Text style={text}>{message}</Text> : null}
    <DetailRows
      rows={[
        ['Order', orderRef],
        ['Status', statusLabel],
        ['Counterparty', counterparty],
      ]}
    />
  </BrandEmail>
)

export const template = {
  component: Email,
  subject: (data: Record<string, any>) =>
    `${data?.title ?? 'P2P order update'}${data?.orderRef ? ` · ${data.orderRef}` : ''}`,
  displayName: 'P2P order update',
  previewData: {
    title: 'Buyer marked paid',
    statusLabel: 'Awaiting release',
    amountLabel: '150.00 OUSD',
    orderRef: 'P2P-4C81',
    counterparty: '@juan',
  },
} satisfies TemplateEntry

export default Email
