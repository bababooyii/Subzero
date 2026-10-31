import type { ReactElement } from "react";

/** Hand-drawn filled 24x24 nav icons (design-system §9, adaptation §2). Inner lines are even-odd cut-outs. */
export type NavIconProps = { size?: number; className?: string };
export type NavIcon = (props: NavIconProps) => ReactElement;

function make(paths: ReactElement): NavIcon {
  return function Icon({ size = 16, className }) {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true" className={className}>
        {paths}
      </svg>
    );
  };
}

export const DashboardIcon = make(
  <path d="M5 3h4a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm10 0h4a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2ZM5 13h4a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2Zm10 0h4a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2Z" />,
);

export const SubscriptionsIcon = make(
  <>
    <path d="M4.5 12a7.5 7.5 0 0 1 15 0h-3a4.5 4.5 0 0 0-9 0h-3Z" />
    <path d="M15 12h6l-3 4.2L15 12Z" />
    <path d="M19.5 12a7.5 7.5 0 0 1-15 0h3a4.5 4.5 0 0 0 9 0h3Z" />
    <path d="M9 12H3l3-4.2L9 12Z" />
  </>,
);

export const BoltIcon = make(
  <path d="M13.6 2.2 4.9 13.1a.8.8 0 0 0 .62 1.3h4.2l-.9 6.8a.5.5 0 0 0 .9.36l8.77-11.08a.8.8 0 0 0-.62-1.3h-4.2l.9-6.8a.5.5 0 0 0-.9-.36Z" />,
);

export const InvoicesIcon = make(
  <path
    fillRule="evenodd"
    d="M6.5 2.5h11A2 2 0 0 1 19.5 4.5v16.6a.5.5 0 0 1-.8.4L16.6 20l-2.1 1.5a.5.5 0 0 1-.6 0L12 20l-1.9 1.5a.5.5 0 0 1-.6 0L7.4 20l-2.1 1.5a.5.5 0 0 1-.8-.4V4.5a2 2 0 0 1 2-2Zm2 4.75a.75.75 0 0 0 0 1.5h7a.75.75 0 0 0 0-1.5h-7Zm0 4a.75.75 0 0 0 0 1.5h7a.75.75 0 0 0 0-1.5h-7Zm0 4a.75.75 0 0 0 0 1.5h4a.75.75 0 0 0 0-1.5h-4Z"
  />,
);

export const PaymentsIcon = make(
  <path
    fillRule="evenodd"
    d="M5 4.5h14A2.5 2.5 0 0 1 21.5 7v10a2.5 2.5 0 0 1-2.5 2.5H5A2.5 2.5 0 0 1 2.5 17V7A2.5 2.5 0 0 1 5 4.5Zm-2.5 4.5v2.5h19V9h-19Zm3 6a.75.75 0 0 0 0 1.5h4a.75.75 0 0 0 0-1.5h-4Z"
  />,
);

export const CustomersIcon = make(
  <>
    <path d="M9 3.5a3.75 3.75 0 1 1 0 7.5 3.75 3.75 0 0 1 0-7.5ZM2.5 19a6.5 6.5 0 0 1 13 0v.5a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1V19Z" />
    <path d="M16.5 4a3.25 3.25 0 1 1 0 6.5 3.25 3.25 0 0 1 0-6.5Zm.9 7.7c2.5.4 4.1 2.5 4.1 5v1.8a1 1 0 0 1-1 1h-3.1c.1-.3.1-.6.1-1V19a8.9 8.9 0 0 0-1.1-4.3 5.5 5.5 0 0 0-.5-.8c.5-.1 1-.2 1.5-.2Z" />
  </>,
);

export const ProductsIcon = make(
  <path d="M12.9 2.2a2 2 0 0 0-1.8 0L4 5.8l8 4 8-4-7.1-3.6ZM3 7.6v8.9a2 2 0 0 0 1.1 1.8l6.9 3.5v-9.9L3 7.6Zm18 0-8 4v9.9l6.9-3.5a2 2 0 0 0 1.1-1.8V7.6Z" />,
);

export const PlansIcon = make(
  <>
    <path d="M11.1 2.9a2 2 0 0 1 1.8 0l8.6 4.4a.8.8 0 0 1 0 1.4l-8.6 4.4a2 2 0 0 1-1.8 0L2.5 8.7a.8.8 0 0 1 0-1.4l8.6-4.4Z" />
    <path d="m3.3 11.6 7.8 4a2 2 0 0 0 1.8 0l7.8-4a.9.9 0 0 1 1.3.8.9.9 0 0 1-.5.8l-8.6 4.4a2 2 0 0 1-1.8 0L2.5 13.2a.9.9 0 0 1-.5-.8.9.9 0 0 1 1.3-.8Z" />
    <path d="m3.3 16 7.8 4a2 2 0 0 0 1.8 0l7.8-4a.9.9 0 0 1 1.3.8.9.9 0 0 1-.5.8l-8.6 4.4a2 2 0 0 1-1.8 0L2.5 17.6a.9.9 0 0 1-.5-.8A.9.9 0 0 1 3.3 16Z" />
  </>,
);

export const TemplatesIcon = make(
  <path
    fillRule="evenodd"
    d="M6.5 2.5h7.2c.5 0 1 .2 1.4.6l3.8 3.8c.4.4.6.9.6 1.4v11.2a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2v-15a2 2 0 0 1 2-2Zm2 9.5a.75.75 0 0 0 0 1.5h7a.75.75 0 0 0 0-1.5h-7Zm0 3.5a.75.75 0 0 0 0 1.5h7a.75.75 0 0 0 0-1.5h-7Z"
  />,
);

export const DiscountsIcon = make(
  <path
    fillRule="evenodd"
    d="M12 2.5h6.5a2 2 0 0 1 2 2V11c0 .53-.21 1.04-.59 1.41l-7 7a2 2 0 0 1-2.82 0l-4.5-4.5a2 2 0 0 1 0-2.82l7-7c.37-.38.88-.59 1.41-.59ZM16 6a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z"
  />,
);

export const SlidersIcon = make(
  <path
    fillRule="evenodd"
    d="M3 6.5A1.5 1.5 0 0 1 4.5 5h6.17a3 3 0 0 1 5.66 0h3.17a1.5 1.5 0 0 1 0 3h-3.17a3 3 0 0 1-5.66 0H4.5A1.5 1.5 0 0 1 3 6.5Zm10.5.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM3 17.5A1.5 1.5 0 0 1 4.5 16h2.17a3 3 0 0 1 5.66 0h7.17a1.5 1.5 0 0 1 0 3h-7.17a3 3 0 0 1-5.66 0H4.5A1.5 1.5 0 0 1 3 17.5Zm6.5.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z"
  />,
);

export const PersonIcon = make(
  <path d="M12 3a4.25 4.25 0 1 1 0 8.5A4.25 4.25 0 0 1 12 3Zm-8 16.5a8 8 0 0 1 16 0v.5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-.5Z" />,
);

export const StoreIcon = make(
  <path
    fillRule="evenodd"
    d="M4.6 3h14.8a1 1 0 0 1 .96.73l1.4 5.1c.07.26.04.53-.1.77A3.5 3.5 0 0 1 18.5 11a3.5 3.5 0 0 1-3.25-1.9A3.5 3.5 0 0 1 12 11a3.5 3.5 0 0 1-3.25-1.9A3.5 3.5 0 0 1 5.5 11a3.5 3.5 0 0 1-2.66-1.4.95.95 0 0 1-.1-.77l1.4-5.1A1 1 0 0 1 4.6 3ZM4 12.4c.5.2 1 .3 1.5.3a4.7 4.7 0 0 0 3-1.05 4.7 4.7 0 0 0 3.5 1.05h-.01a4.7 4.7 0 0 0 3-1.05 4.7 4.7 0 0 0 3 1.05c.5 0 1-.1 1.5-.3V19a2 2 0 0 1-2 2h-3v-5.5a1 1 0 0 0-1-1h-3.5a1 1 0 0 0-1 1V21H6a2 2 0 0 1-2-2v-6.6Z"
  />,
);

export const SignOutIcon = make(
  <path d="M6 3h5a1.5 1.5 0 0 1 0 3H7.5v12H11a1.5 1.5 0 0 1 0 3H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm9.2 4.9a1.5 1.5 0 0 1 2.1 0l3.3 3.3c.6.6.6 1.5 0 2.1l-3.3 3.3a1.5 1.5 0 1 1-2.1-2.1l.8-.7H10.5a1.5 1.5 0 0 1 0-3H16l-.8-.7a1.5 1.5 0 0 1 0-2.2Z" />,
);

export const HomeIcon = make(
  <path d="M12 2.8 2.9 10.4a1 1 0 0 0 .64 1.77H5V19a2 2 0 0 0 2 2h3.25v-5.5a1 1 0 0 1 1-1h1.5a1 1 0 0 1 1 1V21H17a2 2 0 0 0 2-2v-6.83h1.46a1 1 0 0 0 .64-1.77L12 2.8Z" />,
);

export const BackIcon = make(
  <path d="M10.5 4.5 3.2 11.1a1.25 1.25 0 0 0 0 1.8l7.3 6.6a1.1 1.1 0 0 0 1.8-.8V15h7.2a1.5 1.5 0 0 0 1.5-1.5v-3A1.5 1.5 0 0 0 19.5 9h-7.2V5.3a1.1 1.1 0 0 0-1.8-.8Z" />,
);
