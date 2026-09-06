import * as React from 'react'
import { Text } from '@react-email/components'

import type { TemplateEntry } from './registry'
import { BRAND, BrandEmail, DetailRows, amount, text } from './brand'

interface TransactionAlertProps {
  title?: string
  amountLabel?: string
  message?: string
  status?: string
  counterparty?: string | null
  reference?: string | null
  actionUrl?: string
}

const Email = ({
  title = 'Wallet activity',
  amountLabel = '',
  message = '',
  status = 'confirmed',
  counterparty = null,
  reference = null,
  actionUrl = `${BRAND.url}/activity`,
}: TransactionAlertProps) => (
  <BrandEmail
    preview={`${title}${amountLabel ? ` · ${amountLabel}` : ''}`}
    heading={title}
    ctaLabel="View activity"
    ctaUrl={actionUrl}
    footerNote="You receive this because transaction alerts are on in Settings."
  >
    {amountLabel ? <Text style={amount}>{amountLabel}</Text> : null}
    {message ? <Text style={text}>{message}</Text> : null}
    <DetailRows
      rows={[
        ['Status', status],
        ['Counterparty', counterparty ? counterparty.slice(0, 42) : null],
        ['Reference', reference],
      ]}
    />
  </BrandEmail>
)

export const template = {
  component: Email,
  subject: (data: Record<string, any>) =>
    `${data?.title ?? 'Wallet activity'}${data?.amountLabel ? ` · ${data.amountLabel}` : ''}`,
  displayName: 'Transaction alert',
  previewData: {
    title: 'You received OUSD',
    amountLabel: '+250.00 OUSD',
    message: 'Deposit credited to your OpenPay Pro wallet.',
    status: 'confirmed',
    counterparty: 'openpay:qr-pay',
  },
} satisfies TemplateEntry

export default Email
