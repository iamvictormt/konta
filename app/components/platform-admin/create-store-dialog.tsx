"use client";

import { useState, type FormEvent } from "react";
import type { StoreModuleId } from "../../lib/store-modules";
import { STORE_MODULES } from "../../lib/store-modules";
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from "../../lib/password-policy";
import FormField from "../ui/form-field";
import PasswordInput from "../ui/password-input";
import { Modal } from "../konta/shared/modal";
import type { CreateStoreInput } from "./types";

type CreateStoreDialogProps = {
  busy: boolean;
  onClose: () => void;
  onSubmit: (input: CreateStoreInput) => Promise<void>;
};

export function CreateStoreDialog({ busy, onClose, onSubmit }: CreateStoreDialogProps) {
  const [storeName, setStoreName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [initialPassword, setInitialPassword] = useState("");
  const [enabledModules, setEnabledModules] = useState<StoreModuleId[]>(["commerce"]);
  const [error, setError] = useState("");

  function toggleModule(moduleId: StoreModuleId) {
    setEnabledModules((current) => current.includes(moduleId)
      ? current.filter((item) => item !== moduleId)
      : [...current, moduleId]);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (enabledModules.length === 0) {
      setError("Escolha pelo menos um módulo para a conta.");
      return;
    }
    setError("");
    try {
      await onSubmit({ storeName, ownerName, ownerEmail, initialPassword, enabledModules });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Não foi possível criar a conta da loja.");
    }
  }

  return <Modal
    title="Criar loja e acesso"
    subtitle="Cada loja terá uma conta proprietária. O acesso e os módulos podem ser geridos aqui."
    onClose={busy ? () => undefined : onClose}
  >
    <form className="platform-create-store-form" onSubmit={(event) => void submit(event)}>
      <FormField id="new-store-name" label="Nome da loja">
        <input id="new-store-name" name="storeName" autoComplete="organization" required minLength={2} maxLength={160} value={storeName} onChange={(event) => setStoreName(event.target.value)} />
      </FormField>
      <div className="platform-owner-fields">
        <FormField id="new-owner-name" label="Nome do proprietário">
          <input id="new-owner-name" name="ownerName" autoComplete="name" required minLength={2} maxLength={100} value={ownerName} onChange={(event) => setOwnerName(event.target.value)} />
        </FormField>
        <FormField id="new-owner-email" label="Utilizador de acesso (e-mail)">
          <input id="new-owner-email" name="ownerEmail" type="email" autoComplete="off" required maxLength={254} value={ownerEmail} onChange={(event) => setOwnerEmail(event.target.value)} />
        </FormField>
      </div>
      <FormField id="new-owner-password" label="Palavra-passe inicial">
        <PasswordInput id="new-owner-password" name="initialPassword" autoComplete="new-password" required minLength={MIN_PASSWORD_LENGTH} maxLength={MAX_PASSWORD_LENGTH} value={initialPassword} onChange={(event) => setInitialPassword(event.target.value)} />
        <small className="platform-field-hint">Use pelo menos {MIN_PASSWORD_LENGTH} caracteres e entregue as credenciais directamente ao proprietário.</small>
      </FormField>
      <fieldset className="platform-module-picker">
        <legend>Módulos desta conta</legend>
        <p>O proprietário terá acesso apenas aos módulos seleccionados.</p>
        <div className="platform-module-options">
          {STORE_MODULES.map((module) => {
            const selected = enabledModules.includes(module.id);
            return <label className={`platform-module-option${selected ? " is-selected" : ""}`} key={module.id}>
              <input type="checkbox" checked={selected} onChange={() => toggleModule(module.id)} />
              <span className="platform-module-check" aria-hidden="true" />
              <span className="platform-module-copy"><strong>{module.label}</strong><small>{module.id === "commerce" ? module.description : `${module.description} · Disponível numa fase futura.`}</small></span>
            </label>;
          })}
        </div>
      </fieldset>
      {error && <p className="platform-form-error" role="alert">{error}</p>}
      <div className="platform-modal-actions">
        <button className="button button-ghost" type="button" onClick={onClose} disabled={busy}>Cancelar</button>
        <button className="button button-primary" type="submit" disabled={busy || enabledModules.length === 0}>{busy ? "A criar loja…" : "Criar loja"}</button>
      </div>
    </form>
  </Modal>;
}
