"use client";

import { useState, useEffect } from "react";
import Button from "@/shared/components/Button";
import { useNotificationStore } from "@/store/notificationStore";

export default function UsersAdminPage() {
  const [users, setUsers] = useState([]);
  const [combos, setCombos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);

  const [form, setForm] = useState({
    username: "",
    password: "",
    name: "",
    monthlyBudgetUsd: 0,
    allowedCombos: [],
    allowedModelsInput: "",
  });

  const addNotification = useNotificationStore((s) => s.addNotification);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [usersRes, combosRes] = await Promise.all([
        fetch("/api/users"),
        fetch("/api/combos"),
      ]);
      const usersData = await usersRes.json();
      const combosData = await combosRes.json();

      if (usersRes.ok) setUsers(usersData.users || []);
      if (combosRes.ok) setCombos(combosData.combos || []);
    } catch {
      addNotification({ type: "error", message: "Erro ao carregar empresas e combos" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const openCreateModal = () => {
    setEditingUser(null);
    setForm({
      username: "",
      password: "",
      name: "",
      monthlyBudgetUsd: 50,
      allowedCombos: [],
      allowedModelsInput: "gpt-4o-mini, claude-3-5-haiku",
    });
    setShowModal(true);
  };

  const openEditModal = (u) => {
    setEditingUser(u);
    setForm({
      username: u.username,
      password: "",
      name: u.name,
      monthlyBudgetUsd: u.monthlyBudgetUsd || 0,
      allowedCombos: u.allowedCombos || [],
      allowedModelsInput: (u.allowedModels || []).join(", "),
    });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const allowedModels = form.allowedModelsInput
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean);

    try {
      if (editingUser) {
        const payload = {
          name: form.name,
          monthlyBudgetUsd: Number(form.monthlyBudgetUsd),
          allowedCombos: form.allowedCombos,
          allowedModels,
        };
        if (form.password) payload.password = form.password;

        const res = await fetch(`/api/users/${editingUser.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Falha ao salvar");
        addNotification({ type: "success", message: "Empresa atualizada com sucesso!" });
      } else {
        const res = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: form.username,
            password: form.password,
            name: form.name,
            monthlyBudgetUsd: Number(form.monthlyBudgetUsd),
            allowedCombos: form.allowedCombos,
            allowedModels,
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Falha ao criar");
        }
        addNotification({ type: "success", message: "Empresa criada com sucesso!" });
      }
      setShowModal(false);
      fetchData();
    } catch (err) {
      addNotification({ type: "error", message: err.message });
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Tem certeza que deseja remover esta empresa?")) return;
    try {
      const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erro ao deletar");
      addNotification({ type: "success", message: "Empresa removida" });
      fetchData();
    } catch (err) {
      addNotification({ type: "error", message: err.message });
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-main flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[28px]">corporate_fare</span>
            Empresas & Clientes B2B
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Gerencie empresas clientes, combos atribuídos e limites de cota financeira ($ USD).
          </p>
        </div>
        <Button onClick={openCreateModal} variant="primary" className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">add</span>
          Nova Empresa
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12 text-text-muted">
          Carregando empresas...
        </div>
      ) : users.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border-subtle p-12 text-center">
          <span className="material-symbols-outlined text-[48px] text-text-muted/40 mb-3">domain_disabled</span>
          <p className="text-text-muted text-sm font-medium">Nenhuma empresa cliente cadastrada ainda.</p>
          <Button onClick={openCreateModal} variant="secondary" className="mt-4">
            Cadastrar Primeira Empresa
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {users.map((u) => {
            const budget = u.monthlyBudgetUsd || 0;
            const spent = u.currentCycleSpentUsd || 0;
            const percent = budget > 0 ? Math.min(100, Math.round((spent / budget) * 100)) : 0;

            return (
              <div
                key={u.id}
                className="rounded-xl border border-border-subtle bg-surface p-5 space-y-4 hover:border-border-focus transition-colors shadow-sm"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-text-main text-base">{u.name || u.username}</h3>
                    <p className="text-xs text-text-muted font-mono">@{u.username}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${u.isActive ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"}`}>
                    {u.isActive ? "Ativo" : "Inativo"}
                  </span>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-text-muted">
                    <span>Janela de Uso Mensal</span>
                    <span className="font-medium text-text-main">
                      ${spent.toFixed(2)} / {budget > 0 ? `$${budget.toFixed(2)}` : "Ilimitado"}
                    </span>
                  </div>
                  {budget > 0 ? (
                    <div className="w-full bg-surface-2 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${percent >= 100 ? "bg-red-500" : percent >= 80 ? "bg-amber-500" : "bg-primary"}`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  ) : null}
                </div>

                <div className="text-xs text-text-muted space-y-1 pt-1 border-t border-border-subtle">
                  <p>
                    <strong className="text-text-main font-medium">Modelos Permitidos:</strong>{" "}
                    {u.allowedModels?.length > 0 ? u.allowedModels.join(", ") : "Nenhum avulso"}
                  </p>
                  <p>
                    <strong className="text-text-main font-medium">Combos:</strong>{" "}
                    {u.allowedCombos?.length > 0 ? `${u.allowedCombos.length} atribuído(s)` : "Nenhum"}
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button onClick={() => openEditModal(u)} variant="ghost" className="text-xs py-1 px-2">
                    Editar
                  </Button>
                  <Button onClick={() => handleDelete(u.id)} variant="ghost" className="text-xs py-1 px-2 text-red-500 hover:text-red-600">
                    Remover
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-surface border border-border-subtle rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-4 my-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-border-subtle">
              <h2 className="text-lg font-bold text-text-main flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[22px]">
                  {editingUser ? "edit_square" : "domain_add"}
                </span>
                {editingUser ? `Editar: ${editingUser.name}` : "Nova Empresa Cliente"}
              </h2>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-text-muted hover:text-text-main transition-colors p-1 rounded-md"
                aria-label="Fechar modal"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Nome da Empresa</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-lg border border-border-subtle bg-surface-2 px-3 py-2 text-sm text-text-main focus:outline-none focus:border-primary"
                  placeholder="Ex: Empresa ACME"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Usuário de Login (username)</label>
                <input
                  type="text"
                  required
                  disabled={!!editingUser}
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  className="w-full rounded-lg border border-border-subtle bg-surface-2 px-3 py-2 text-sm text-text-main focus:outline-none focus:border-primary disabled:opacity-50"
                  placeholder="Ex: empresa_acme"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">
                  {editingUser ? "Nova Senha (deixe em branco para manter)" : "Senha de Acesso"}
                </label>
                <input
                  type="password"
                  required={!editingUser}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full rounded-lg border border-border-subtle bg-surface-2 px-3 py-2 text-sm text-text-main focus:outline-none focus:border-primary"
                  placeholder="••••••••"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Cota Orçamentária Mensal ($ USD)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.monthlyBudgetUsd}
                  onChange={(e) => setForm({ ...form, monthlyBudgetUsd: e.target.value })}
                  className="w-full rounded-lg border border-border-subtle bg-surface-2 px-3 py-2 text-sm text-text-main focus:outline-none focus:border-primary"
                  placeholder="0 = ilimitado"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Modelos Permitidos (separados por vírgula)</label>
                <input
                  type="text"
                  value={form.allowedModelsInput}
                  onChange={(e) => setForm({ ...form, allowedModelsInput: e.target.value })}
                  className="w-full rounded-lg border border-border-subtle bg-surface-2 px-3 py-2 text-sm text-text-main focus:outline-none focus:border-primary"
                  placeholder="gpt-4o-mini, claude-3-5-haiku"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Combos Permitidos</label>
                {combos.length === 0 ? (
                  <p className="text-xs text-text-muted italic py-1">Nenhum combo cadastrado no sistema ainda.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto p-2 border border-border-subtle rounded-lg bg-surface-2">
                    {combos.map((c) => {
                      const checked = form.allowedCombos.includes(c.id) || form.allowedCombos.includes(c.name);
                      return (
                        <label key={c.id} className="flex items-center gap-2 text-xs text-text-main cursor-pointer">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setForm({ ...form, allowedCombos: [...form.allowedCombos, c.id] });
                              } else {
                                setForm({
                                  ...form,
                                  allowedCombos: form.allowedCombos.filter((x) => x !== c.id && x !== c.name),
                                });
                              }
                            }}
                          />
                          <span className="truncate">{c.name}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-4">
                <Button type="button" onClick={() => setShowModal(false)} variant="secondary">
                  Cancelar
                </Button>
                <Button type="submit" variant="primary">
                  Salvar
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
