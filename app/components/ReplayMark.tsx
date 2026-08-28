import { useId } from "react";

type ReplayMarkProps = {
  className?: string;
  title?: string;
};

export function ReplayMark({ className, title }: ReplayMarkProps) {
  const maskId = useId();

  return <svg
    className={className}
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    role={title ? "img" : undefined}
    aria-hidden={title ? undefined : true}
    aria-label={title}
  >
    <defs>
      <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="64" height="64">
        <rect width="64" height="64" fill="white" />
        <path fill="black" d="M32.8 28.7Q34 28.5 34 30.1V42.9Q34 44.5 32.8 44.3Q32.3 44.2 31.9 43.8L27.5 37.9Q26 36.5 27.5 35.1L31.9 29.2Q32.3 28.8 32.8 28.7ZM44.8 28.7Q46 28.5 46 30.1V42.9Q46 44.5 44.8 44.3Q44.3 44.2 43.9 43.8L39.5 37.9Q38 36.5 39.5 35.1L43.9 29.2Q44.3 28.8 44.8 28.7Z" />
      </mask>
    </defs>
    <g fill="currentColor" mask={`url(#${maskId})`}>
      <path fillRule="evenodd" d="M18 10H36Q44 10 44 18V36Q44 44 36 44H18Q10 44 10 36V18Q10 10 18 10ZM18 14.5H36Q39.5 14.5 39.5 18V36Q39.5 39.5 36 39.5H18Q14.5 39.5 14.5 36V18Q14.5 14.5 18 14.5Z" />
      <path d="M28 19.5H46Q54 19.5 54 27.5V45.5Q54 53.5 46 53.5H28Q20 53.5 20 45.5V27.5Q20 19.5 28 19.5Z" />
    </g>
  </svg>;
}
