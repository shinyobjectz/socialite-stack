import * as React from 'react';

type CommonProps = {
  className?: string;
  style?: React.CSSProperties;
};

function cx(...parts: Array<string | undefined | null | false>) {
  return parts.filter(Boolean).join(' ');
}

export type SocialiteWordmarkProps = CommonProps & {
  /**
   * Defaults to `"/Socialite.svg"` (served from `packages/frontend/core/public/Socialite.svg`).
   *
   * You can override this if you move the asset or want to use a CDN.
   */
  src?: string;

  /**
   * Accessible name for the wordmark image.
   * If you pass `decorative`, this will be ignored and the image will be hidden from AT.
   */
  alt?: string;

  /**
   * If true, hides the image from assistive tech (useful when paired with adjacent text).
   */
  decorative?: boolean;

  /**
   * Explicit size controls.
   * If omitted, the intrinsic SVG dimensions / CSS will determine size.
   */
  width?: number | string;
  height?: number | string;

  /**
   * Defaults to `"auto"` to preserve aspect ratio with `height` if provided.
   */
  objectFit?: React.CSSProperties['objectFit'];
};

/**
 * Socialite wordmark (text logo).
 *
 * This renders a plain `<img>` pointing at `"/Socialite.svg"` so it works with
 * public-asset serving (no bundler-specific SVG loader required).
 */
export const SocialiteWordmark = React.forwardRef<
  HTMLImageElement,
  SocialiteWordmarkProps
>(function SocialiteWordmark(
  {
    src = '/Socialite.svg',
    alt = 'Socialite',
    decorative = false,
    width,
    height,
    objectFit = 'contain',
    className,
    style,
  },
  ref
) {
  const ariaProps = decorative
    ? ({ alt: '', 'aria-hidden': true } as const)
    : ({ alt } as const);

  return (
    <img
      ref={ref}
      src={src}
      {...ariaProps}
      className={cx('socialite-wordmark', className)}
      style={{
        display: 'inline-block',
        verticalAlign: 'middle',
        width,
        height,
        objectFit,
        ...style,
      }}
    />
  );
});

export type SocialiteMarkProps = CommonProps & {
  /**
   * Source for the Socialite logomark (the martini glass icon).
   *
   * This is rendered as an inline SVG (`<svg><image .../></svg>`) so callers can
   * style and align it consistently alongside the wordmark.
   *
   * Example: `"/imgs/socialite-mark.png"` (served from `core/public/imgs/...`).
   */
  src: string;

  /**
   * Accessible name for the mark.
   * If you pass `decorative`, this will be ignored and the SVG will be hidden from AT.
   */
  alt?: string;

  /**
   * If true, hides the mark from assistive tech (useful when paired with adjacent text).
   */
  decorative?: boolean;

  /**
   * Explicit size controls.
   * If `size` is provided, it will be used for both width/height unless overridden.
   */
  size?: number | string;
  width?: number | string;
  height?: number | string;
};

/**
 * Socialite logomark (icon) as an inline SVG.
 *
 * Note: this does not invent/approximate the vector; it embeds the provided asset
 * via `<image href="...">` inside an SVG wrapper.
 */
export const SocialiteMark = React.forwardRef<SVGSVGElement, SocialiteMarkProps>(
  function SocialiteMark(
    {
      src,
      alt = 'Socialite',
      decorative = false,
      size,
      width,
      height,
      className,
      style,
    },
    ref
  ) {
    const resolvedWidth = width ?? size;
    const resolvedHeight = height ?? size ?? resolvedWidth;

    const ariaProps = decorative
      ? ({ 'aria-hidden': true } as const)
      : ({ role: 'img', 'aria-label': alt } as const);

    return (
      <svg
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid meet"
        {...ariaProps}
        className={cx('socialite-mark', className)}
        style={{
          display: 'inline-block',
          verticalAlign: 'middle',
          width: resolvedWidth,
          height: resolvedHeight,
          ...style,
        }}
      >
        {decorative ? null : <title>{alt}</title>}
        <image href={src} width="100" height="100" preserveAspectRatio="xMidYMid meet" />
      </svg>
    );
  }
);

export type SocialiteLockupProps = CommonProps & {
  /**
   * If provided, renders the logomark to the left of the wordmark.
   */
  markSrc?: string;

  /**
   * Defaults to `"Socialite"` for the wordmark and mark (when not decorative).
   */
  alt?: string;

  /**
   * If true, hides images from AT (useful if you also render adjacent text).
   */
  decorative?: boolean;

  /**
   * Size controls (applied to wordmark by default, and mark via `markSize`).
   */
  wordmarkHeight?: number | string;

  /**
   * Mark size in pixels (or CSS length). Defaults to the wordmark height when provided,
   * else defaults to `24`.
   */
  markSize?: number | string;

  /**
   * Space between mark and wordmark. Defaults to `8`.
   */
  gap?: number | string;
};

/**
 * Socialite brand lockup: optional mark on the left + wordmark on the right.
 *
 * This is intended to be used in headers / nav bars where you want a single component
 * for the full brand treatment.
 */
export const SocialiteLockup: React.FC<SocialiteLockupProps> = ({
  markSrc = '/imgs/socialite-mark.webp',
  alt = 'Socialite',
  decorative = false,
  wordmarkHeight,
  markSize,
  gap = 8,
  className,
  style,
}) => {
  const resolvedMarkSize = markSize ?? wordmarkHeight ?? 24;

  return (
    <span
      className={cx('socialite-lockup', className)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap,
        ...style,
      }}
    >
      {markSrc ? (
        <SocialiteMark
          src={markSrc}
          alt={alt}
          decorative={decorative}
          size={resolvedMarkSize}
        />
      ) : null}
      <SocialiteWordmark
        alt={alt}
        decorative={decorative}
        height={wordmarkHeight}
      />
    </span>
  );
};
