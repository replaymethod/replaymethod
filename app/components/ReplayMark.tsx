type ReplayMarkProps = {
  className?: string;
  title?: string;
};

export function ReplayMark({ className, title }: ReplayMarkProps) {
  return <svg
    className={className}
    viewBox="0 0 36 36"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    role={title ? "img" : undefined}
    aria-hidden={title ? undefined : true}
    aria-label={title}
  >
    <path d="M4.5 23.75C8.35 23.75 8.15 11 12.25 11C16.35 11 16.15 23.75 20.25 23.75C24.35 23.75 24.15 11 28.25 11C31.3 11 32 17.1 31.35 20.45" stroke="currentColor" strokeWidth="3.15" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M27.85 18.55L31.35 20.45L33.2 16.9" stroke="currentColor" strokeWidth="3.15" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
}
