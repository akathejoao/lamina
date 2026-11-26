// A marca: uma folha de planilha com o canto superior direito cortado em diagonal, como um fio de lâmina.
// A barra clara é a coluna A, as três linhas são as células que ela alinha.
export function Mark({ className = "size-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <path d="M3 0h18l11 11v18a3 3 0 0 1-3 3H3a3 3 0 0 1-3-3V3a3 3 0 0 1 3-3z" fill="#7c5cff" />
      <path d="M8 9h3.4v17H8z" fill="#f6f3fb" />
      <path d="M14.6 14h9.8v2.2h-9.8zM14.6 18.6h7.6v2.2h-7.6zM14.6 23.2h5.2v2.2h-5.2z" fill="#0c0b10" />
    </svg>
  );
}
