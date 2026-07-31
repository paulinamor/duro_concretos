export default function SuspendedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="max-w-md text-center space-y-4 p-8">
        <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-destructive">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-foreground">Cuenta suspendida</h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Tu suscripción a Duro Concretos ERP no está activa. Contacta a Software & Solutions LP para reactivar tu cuenta.
        </p>
        <a
          href="mailto:soporte@lpsoft.mx"
          className="inline-block mt-4 px-6 py-2.5 rounded-lg bg-foreground text-background text-sm font-medium"
        >
          Contactar soporte
        </a>
      </div>
    </div>
  )
}
