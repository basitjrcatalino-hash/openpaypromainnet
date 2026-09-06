import * as React from 'react'
import { Text } from '@react-email/components'

import type { TemplateEntry } from './registry'
import { BRAND, BrandEmail, DetailRows, amount, text } from './brand'

interface TopupCreditedProps {
  amountLabel?: string
  method?: string
  reference?: string | null
  fiatLabel?: string | null
  actionUrl?: string
}

const Email = ({
  amountLabel = '',
  method = 'Top up',
  reference = null,
  fiatLabel = null,
  actionUrl = `${BRAND.url}/activity`,
}: TopupCreditedProps) => (
  <BrandEmail
    preview={`Top up credited${amountLabel ? ` · ${amountLabel}` : ''}`}
    heading="Top up credited"
    ctaLabel="View balance"
    ctaUrl={actionUrl}
    footerNote="You receive this because transaction alerts are on in Settings."
  >
    {amountLabel ? <Text style={amount}>{amountLabel}</Text> : null}
    <Text style={text}>Your funds have landed and are ready to use.</Text>
    <DetailRows
      rows={[
        ['Method', method],
        ['Paid', fiatLabel],
        ['Reference', reference],
      ]}
    />
  </BrandEmail>
)

export const template = {
  component: Email,
  subject: (data: Record<string, any>) =>
    `Top up credited${data?.amountLabel ? ` · ${data.amountLabel}` : ''}`,
  displayName: 'Top up credited',
  previewData: {
    amountLabel: '+100.00 OUSD',
    method: 'QR Ph & e-wallets',
    fiatLabel: '₱6,272.00',
    reference: 'TOPUP-8F2A11',
  },
} satisfies TemplateEntry

export default Email
