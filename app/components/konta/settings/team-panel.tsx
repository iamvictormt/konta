import { useEffect, useState, type FormEvent } from "react";
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from "@/app/lib/password-policy";
import { STORE_PERMISSIONS, type StorePermission } from "@/app/lib/store-permissions";
import FormField from "../../ui/form-field";
import PasswordInput from "../../ui/password-input";
import Icon from "../../ui-icon";

type Employee = { id: string; name: string; email: string; active: boolean; permissions: StorePermission[] };
const permissionLabels: Record<StorePermission, string> = {
  "products:write": "Cadastrar e editar produtos",
  "revenue:read": "Ver faturação",
};
const teamUrl = "/api/commerce/team";

export function TeamPanel({ online, notify }: { online: boolean; notify: (message: string) => void }) {
  const [employees, setEmployees] = useState<Employee[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!online) return;
    const controller = new AbortController();
    fetch(teamUrl, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const data = await response.json() as { employees: Employee[] };
        if (!controller.signal.aborted) {
          setEmployees(data.employees);
          setError("");
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setError("Não foi possível carregar a equipa.");
      });
    return () => controller.abort();
  }, [online, reload]);

  async function save(method: "POST" | "PATCH", data: object, success: string) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(teamUrl, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        signal: AbortSignal.timeout(10_000),
      });
      const result = await response.json() as { employee?: Employee; id?: string; active?: boolean; permissions?: StorePermission[]; error?: { message: string } };
      if (!response.ok) throw new Error(result.error?.message ?? "Não foi possível guardar a alteração.");
      const employee = result.employee;
      if (employee) {
        setEmployees((current) => [...(current ?? []), employee].sort((left, right) => left.name.localeCompare(right.name, "pt")));
        setAdding(false);
      } else {
        const { id, active, permissions } = result;
        setEmployees((current) => current?.map((item) => item.id === id
          ? { ...item, active: active ?? item.active, permissions: permissions ?? item.permissions }
          : item) ?? null);
      }
      notify(success);
    } catch (cause) {
      setError(cause instanceof Error && cause.name === "Error" ? cause.message : "Não foi possível guardar a alteração. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  function addEmployee(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !online) return;
    const form = new FormData(event.currentTarget);
    void save("POST", Object.fromEntries(form), "Conta de funcionário criada.");
  }

  return <section className="panel settings-panel store-team-panel" aria-labelledby="store-team-title">
    <div className="store-team-header">
      <div>
        <h2 id="store-team-title">Equipa da loja</h2>
        <p>Os funcionários podem consultar produtos e registar vendas, despesas e movimentos do próprio caixa.</p>
      </div>
      <button className="button button-primary" type="button" disabled={!online || busy || adding || employees === null} onClick={() => setAdding(true)}>
        <Icon name="plus" size={16} /> Adicionar funcionário
      </button>
    </div>
    {!online && <p>Ligue-se à internet para gerir a equipa.</p>}
    {error && <p role="alert" className="settings-form-error">{error}</p>}
    {online && employees === null && (error
      ? <button className="button button-ghost" type="button" onClick={() => setReload((value) => value + 1)}>Tentar novamente</button>
      : <p role="status">A carregar a equipa…</p>)}
    {adding && <form className="store-team-form" onSubmit={addEmployee}>
      <div className="form-grid">
        <FormField id="employee-name" label="Nome"><input id="employee-name" name="name" required minLength={2} maxLength={100} /></FormField>
        <FormField id="employee-email" label="E-mail"><input id="employee-email" name="email" type="email" required maxLength={254} /></FormField>
        <FormField id="employee-password" label="Palavra-passe inicial" className="full">
          <PasswordInput id="employee-password" name="password" autoComplete="new-password" required minLength={MIN_PASSWORD_LENGTH} maxLength={MAX_PASSWORD_LENGTH} />
        </FormField>
      </div>
      <div className="modal-actions">
        <button className="button button-ghost" type="button" disabled={busy} onClick={() => setAdding(false)}>Cancelar</button>
        <button className="button button-primary" type="submit" disabled={busy || !online}>{busy ? "A guardar…" : "Criar conta"}</button>
      </div>
    </form>}
    {employees?.length === 0 && <p>Ainda não há funcionários cadastrados.</p>}
    {employees && employees.length > 0 && <ul className="store-team-list">
      {employees.map((employee) => <li key={employee.id}>
        <div><strong>{employee.name}</strong><small>{employee.email} · {employee.active ? "Activo" : "Inactivo"}</small></div>
        <button className="button button-ghost" type="button" disabled={busy || !online}
          aria-label={`${employee.active ? "Desactivar" : "Reactivar"} ${employee.name}`}
          onClick={() => void save("PATCH", { id: employee.id, active: !employee.active }, employee.active ? "Acesso desactivado." : "Acesso reactivado.")}
        >{employee.active ? "Desactivar acesso" : "Reactivar acesso"}</button>
        <fieldset className="employee-permissions" disabled={busy || !online}>
          <legend>Permissões de {employee.name}</legend>
          {STORE_PERMISSIONS.map((permission) => <label key={permission}>
            <input type="checkbox" checked={employee.permissions.includes(permission)} onChange={(event) => {
              const permissions = event.target.checked
                ? [...employee.permissions, permission]
                : employee.permissions.filter((item) => item !== permission);
              void save("PATCH", { id: employee.id, permissions }, "Permissões actualizadas.");
            }} />
            {permissionLabels[permission]}
          </label>)}
        </fieldset>
      </li>)}
    </ul>}
  </section>;
}
