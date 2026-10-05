// Real code organization and runtime relationship of the monorepo. Rendered as
// structured HTML so it reflows and stays available to assistive technology.
export function ArchitectureOverview() {
  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="arch-code">
        <h3 id="arch-code" className="text-sm font-semibold">
          Organización del código
        </h3>
        <ul className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
          <li className="rounded-md border p-3">
            <span className="font-medium">apps/web</span>
            <span className="block text-muted-foreground">
              Cliente React con Vite y TanStack Router/Query
            </span>
          </li>
          <li className="rounded-md border p-3">
            <span className="font-medium">apps/api</span>
            <span className="block text-muted-foreground">
              Host NestJS que integra los servicios
            </span>
          </li>
          <li className="rounded-md border p-3">
            <span className="font-medium">libs/auth</span>
            <span className="block text-muted-foreground">
              Identidad, credenciales y sesiones
            </span>
          </li>
          <li className="rounded-md border p-3">
            <span className="font-medium">libs/users</span>
            <span className="block text-muted-foreground">
              Perfiles de negocio
            </span>
          </li>
          <li className="rounded-md border p-3">
            <span className="font-medium">libs/orders</span>
            <span className="block text-muted-foreground">
              Servicio de pedidos
            </span>
          </li>
        </ul>
      </section>

      <section aria-labelledby="arch-runtime">
        <h3 id="arch-runtime" className="text-sm font-semibold">
          Ejecución
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          apps/api aloja los módulos auth, users y orders; en este boilerplate
          no se despliegan como servicios independientes.
        </p>
        <div className="mt-3 flex flex-col items-stretch gap-2 text-sm sm:flex-row sm:items-center">
          <span className="rounded-md border p-3 text-center">apps/web</span>
          <span
            aria-hidden="true"
            className="text-center text-muted-foreground"
          >
            HTTP (cookies)
          </span>
          <span className="rounded-md border p-3 text-center">apps/api</span>
          <span
            aria-hidden="true"
            className="text-center text-muted-foreground"
          >
            integra
          </span>
          <span className="rounded-md border p-3 text-center">
            auth · users · orders
          </span>
        </div>
      </section>

      <section aria-labelledby="arch-layers">
        <h3 id="arch-layers" className="text-sm font-semibold">
          Capas por servicio
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          infrastructure → application → domain
        </p>
        <ol className="mt-2 flex flex-col gap-1 text-sm">
          <li className="rounded-md border p-2">infrastructure</li>
          <li className="rounded-md border p-2">application</li>
          <li className="rounded-md border p-2">domain</li>
        </ol>
      </section>
    </div>
  );
}
