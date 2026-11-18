const REFUSED = /['"`]|--|\/\*|\*\/|;|\$\{/;

export function assertParameterized(text: string): void {
  const query = text.trim();
  if (!query) throw new Error("sql: consulta vazia");
  if (REFUSED.test(query)) {
    throw new Error("sql: literais, comentários e mais de um comando são recusados; use parâmetros");
  }
}
