export function Mark({ className = "size-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#7c5cff" />
      <path d="M10 8h3.2v16H10z" fill="#f6f3fb" />
      <path d="M16.2 12h8.2v2.2h-8.2zM16.2 16.4h6.4v2.2h-6.4zM16.2 20.8h4.6v2.2h-4.6z" fill="#0c0b10" />
    </svg>
  );
}
