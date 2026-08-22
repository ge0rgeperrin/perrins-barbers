/**
 * The HTML shell every statically rendered page is poured into. This file only
 * ever runs on the web, at build time — it is not part of the native app.
 *
 * It carries the things Google needs for a local business and React cannot put
 * there itself: the language, the viewport, the theme colour, and one block of
 * structured data describing the shop.
 */
import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';
import { color } from '../theme';
import { business, hours } from '../lib/content';
import { bundledServices, priceRange } from '../lib/services';

const SITE = 'https://perrinsbarbers.co.uk';

const SCHEMA_DAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

/** Generated from the same hours the visible table renders, so they cannot disagree. */
const structuredData = {
  '@context': 'https://schema.org',
  '@type': 'HairSalon',
  name: business.name,
  description: business.about,
  url: SITE,
  telephone: `+44${business.phone.replace(/\D/g, '').replace(/^0/, '')}`,
  priceRange: priceRange(bundledServices),
  currenciesAccepted: 'GBP',
  address: {
    '@type': 'PostalAddress',
    streetAddress: business.address[0],
    addressLocality: business.address[1],
    postalCode: business.address[2],
    addressCountry: 'GB',
  },
  hasMap: business.mapsUrl,
  sameAs: [business.instagram, business.facebook],
  // Read from the synced list, so the barbers Google knows about are the
  // barbers actually in the diary at the last deploy.
  employee: bundledServices.providers.map((provider) => ({
    '@type': 'Person',
    name: provider.name,
    jobTitle: provider.role || 'Barber',
  })),
  makesOffer: bundledServices.providers.flatMap((provider) =>
    provider.services
      .filter((service) => typeof service.priceGBP === 'number')
      .map((service) => ({
        '@type': 'Offer',
        itemOffered: { '@type': 'Service', name: service.name },
        price: service.priceGBP,
        priceCurrency: 'GBP',
        availableAtOrFrom: { '@type': 'Place', name: business.name },
      }))
  ),
  openingHoursSpecification: hours
    .filter((entry) => !entry.closed)
    .map((entry) => ({
      '@type': 'OpeningHoursSpecification',
      dayOfWeek: `https://schema.org/${SCHEMA_DAYS[entry.day]}`,
      opens: entry.opens,
      closes: entry.closes,
    })),
  potentialAction: {
    '@type': 'ReserveAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: bundledServices.source,
      actionPlatform: [
        'https://schema.org/DesktopWebPlatform',
        'https://schema.org/MobileWebPlatform',
      ],
    },
    result: { '@type': 'Reservation', name: 'Book an appointment' },
  },
};

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en-GB">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        <meta name="theme-color" content={color.ink} />
        <meta name="color-scheme" content="dark" />

        {/* Per-page title, description, og:title/description/url and canonical
            are set by <PageHead> on each screen — don't repeat them here or the
            page ships two of each. */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content={business.name} />
        <meta property="og:locale" content="en_GB" />
        <meta name="twitter:card" content="summary_large_image" />

        {/* Stops the body scrolling behind the app's own scroll views. */}
        <ScrollViewStyleReset />

        <style dangerouslySetInnerHTML={{ __html: baseStyle }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}

/**
 * The handful of things that have to be CSS rather than React Native styles.
 *
 * Mostly this is about how a phone browser behaves, which is where every bit of
 * jank on a mobile web page comes from: the grey flash on every tap, the rubber
 * band at the end of a scroll, iOS quietly inflating type in landscape.
 */
const baseStyle = `
  html, body { background-color: ${color.ink}; color-scheme: dark; }
  body { margin: 0; -webkit-font-smoothing: antialiased; }
  ::selection { background: ${color.gold}; color: ${color.onGold}; }

  /* Hover states only where there is a pointer that can hover. A touch screen
     fires hover on tap, so without this every tap on a phone leaves a row
     stuck in its hover colour until you tap something else. */
  @media (hover: none) {
    *:hover { transition: none !important; }
  }

  /* iOS decides on its own that some text should be bigger in landscape, which
     silently breaks a type scale. */
  html { -webkit-text-size-adjust: 100%; text-size-adjust: 100%; }

  /* The default grey box on every tap is a browser artefact, not a design
     decision — the app draws its own pressed states. */
  * { -webkit-tap-highlight-color: transparent; }

  /* No rubber-banding the whole page past the end of a scroll view. */
  html, body { overscroll-behavior-y: none; }

  /* A keyboard user has to be able to see where they are. Pointer users do not
     get an outline, because :focus-visible only fires for keyboards. */
  :focus-visible {
    outline: 2px solid ${color.gold};
    outline-offset: 2px;
    border-radius: 2px;
  }

  /* Belt and braces with the in-app reduced-motion switch: this also catches
     anything the browser animates on our behalf. */
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.001ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.001ms !important;
      scroll-behavior: auto !important;
    }
  }
`;
