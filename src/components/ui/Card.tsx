import type { HTMLAttributes } from 'react';

export type CardPadding = 'none' | 'sm' | 'md' | 'lg';
export type CardTone = 'default' | 'variant';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: CardPadding;
  tone?: CardTone;
}

/** A neutral surface container; it deliberately contains no product state or actions. */
export function Card({ padding = 'md', tone = 'default', className, ...props }: CardProps) {
  const classes = [
    'mar-ui-card',
    'mar-ui-card--pad-' + padding,
    tone === 'variant' ? 'mar-ui-card--variant' : '',
    className ?? '',
  ].filter(Boolean).join(' ');

  return <div {...props} className={classes} />;
}
