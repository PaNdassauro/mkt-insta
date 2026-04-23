/**
 * Aviso sobre posts em colaboração (co-authoring) que a Meta Graph API não retorna
 * pra conta co-autora. Usado em /posts, /reels e /settings/system.
 */
export default function CollabNotice({ className }: { className?: string }) {
  return (
    <div
      className={
        'rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200 ' +
        (className ?? '')
      }
      role="note"
    >
      <div className="font-medium">Posts em colaboração (co-authoring) não aparecem aqui</div>
      <div className="mt-1">
        Quando um post ou Reel é publicado como colaboração entre duas contas, a Meta Graph API só retorna o conteúdo pra{' '}
        <strong>conta owner</strong> (quem clicou em &ldquo;Publicar&rdquo;). Se @welcomeweddings for só co-autora, o post aparece no feed do Instagram mas não nesta lista — é limitação da API, não falha do sync.
      </div>
    </div>
  )
}
