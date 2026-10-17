// Помощник навигации: менять hash вне компонентов,
// чтобы не мутировать внешние значения внутри рендер-логики
export function setHash(hash: string) {
  if (typeof window !== 'undefined' && window.location.hash !== hash) {
    window.location.hash = hash
  }
}

export function clearHash() {
  if (typeof window !== 'undefined' && window.location.hash) {
    window.location.hash = ''
  }
}
