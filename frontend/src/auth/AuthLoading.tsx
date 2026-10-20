/** Stato neutro a schermo intero mostrato mentre la sessione viene
 *  ripristinata (e da RequireAuth come fallback difensivo). Non mostra
 *  mai la shell dell'app né la pagina di login. */
export default function AuthLoading() {
  return (
    <div className="flex min-h-app items-center justify-center bg-background">
      <p className="text-sm text-muted-foreground" role="status">Caricamento…</p>
    </div>
  );
}
