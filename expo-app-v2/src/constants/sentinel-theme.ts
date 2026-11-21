/**
 * Semantic colors for the Sentinelle screens.
 *
 * The base theme in `theme.ts` only exposes surface and text tokens, so the
 * status colors (accent, success, warning, danger) live here with a light and
 * a dark variant.
 */

import { useColorScheme } from '@/hooks/use-color-scheme';

export type SentinelColors = {
  accent: string;
  accentStrong: string;
  accentSoft: string;
  accentText: string;
  success: string;
  successSoft: string;
  successBorder: string;
  /** Outline for success surfaces; 3:1 against both the fill and the page. */
  successBorderStrong: string;
  warning: string;
  warningSoft: string;
  warningBorder: string;
  /** Outline for warning surfaces; 3:1 against both the fill and the page. */
  warningBorderStrong: string;
  danger: string;
  dangerSoft: string;
  dangerBorder: string;
  /** Outline for danger surfaces; 3:1 against both the fill and the page. */
  dangerBorderStrong: string;
  /** Decorative outline for cards and grouping surfaces. */
  border: string;
  /** Boundary of interactive controls (inputs), where WCAG 1.4.11 needs 3:1. */
  borderStrong: string;
  /** Outline for surfaces filled with `backgroundSelected`. */
  borderSelected: string;
  muted: string;
};

const SentinelPalette: Record<'light' | 'dark', SentinelColors> = {
  light: {
    accent: '#B06A5F',
    accentStrong: '#A85A50',
    accentSoft: '#FAEDEA',
    accentText: '#8A5A50',
    success: '#487350',
    successSoft: '#E8F2EB',
    successBorder: '#D8E8DD',
    successBorderStrong: '#5E8F6B',
    warning: '#8A6423',
    warningSoft: '#FFF0D9',
    warningBorder: '#F0D9B5',
    warningBorderStrong: '#A8842F',
    danger: '#A8473D',
    dangerSoft: '#FFE2DE',
    dangerBorder: '#F5BBB3',
    dangerBorderStrong: '#B9685E',
    border: '#E4DFDC',
    borderStrong: '#8F857F',
    borderSelected: '#7E736D',
    muted: '#6A5E58',
  },
  dark: {
    accent: '#E0A295',
    accentStrong: '#A85A50',
    accentSoft: '#3A2A27',
    accentText: '#F0B9AC',
    success: '#8FC79B',
    successSoft: '#1E2A21',
    successBorder: '#2E4433',
    successBorderStrong: '#5A8A64',
    warning: '#E3B573',
    warningSoft: '#332A1B',
    warningBorder: '#4A3B24',
    warningBorderStrong: '#94723A',
    danger: '#F0928A',
    dangerSoft: '#3A2321',
    dangerBorder: '#54302C',
    dangerBorderStrong: '#A4665C',
    border: '#33363A',
    borderStrong: '#6E737A',
    borderSelected: '#7C828A',
    muted: '#B0B4BA',
  },
};

export function useSentinelColors(): SentinelColors {
  const scheme = useColorScheme();
  return SentinelPalette[scheme === 'dark' ? 'dark' : 'light'];
}
