"use client";

import { useState, useEffect } from "react";
import Button from "@/shared/components/Button";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";
import { useNotificationStore } from "@/store/notificationStore";

export default function ClientUsageDashboard() {
  const [data, setData] = useState(null);
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newKeyName, setNewKeyName] = useState("");
  const [isCreatingKey, setIsCreatingKey] = useState(false);

  const { copied, copy } = useCopyToClipboard(2000);
  const addNotification = useNotificationStore((s) => s.addNotification);

  const loadData = async () => {
    setLoading(true);
    try {
      const [usageRes, keysRes] = await Promise.all([
        fetch("/api/client/usage"),
        fetch("/api/keys"),
      ]);

      if (usageRes.ok) {
        const usageJson = await usageRes.json();
        setData(usageJson);
      }
      if (keysRes.ok) {
        const keysJson = await keysRes.json();
        setKeys(keysJson.keys || []);
      }
    } catch {
      addNotification({ type: "error", message: "Erro ao carregar dados do painel" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateKey = async (e) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    setIsCreatingKey(true);
    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newKeyName.trim() }),
      });
      if (!res.ok) throw new Error("Falha ao criar API Key");
      addNotification({ type: "success", message: "Nova API Key gerada com sucesso!" });
      setNewKeyName("");
      loadData();
    } catch (err) {
      addNotification({ type: "error", message: err.message });
    } finally {
      setIsCreatingKey(false);
    }
  };

  const handleRevokeKey = async (id) => {
    if (!confirm("Tem certeza que deseja revogar esta API Key? Ela parará de funcionar imediatamente.")) return;
    try {
      const res = await fetch(`/api/keys/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erro ao revogar chave");
      addNotification({ type: "success", message: "Chave revogada com sucesso" });
      loadData();
    } catch (err) {
      addNotification({ type: "error", message: err.message });
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-12 text-text-muted">
        Carregando painel de consumo...
      </div>
    );
  }

  const quota = data?.quota || {};
  const isExceeded = quota.isExceeded;
  const percent = quota.usagePercent || 0;

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-text-main flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-[28px]">speed</span>
          Visão Geral & Consumo
        </h1>
        <p className="text-sm text-text-muted mt-1">
          Acompanhe sua janela de uso em tempo real e gerencie suas chaves de API.
        </p>
      </div>

      {/* Widget Principal: Janela de Consumo em % */}
      <div className={`rounded-xl border p-6 space-y-4 shadow-sm bg-surface ${isExceeded ? "border-red-500/50 bg-red-500/5" : "border-border-subtle"}`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">Janela de Uso do Ciclo Atual</span>
            <h2 className="text-3xl font-extrabold text-text-main mt-1">
              {percent}% <span className="text-sm font-normal text-text-muted">utilizado</span>
            </h2>
          </div>
          <div className="text-right sm:text-right">
            <span className="text-xs text-text-muted block">Gasto Acumulado / Limite</span>
            <span className="text-xl font-bold text-text-main">
              ${(quota.currentCycleSpentUsd || 0).toFixed(2)} / {quota.monthlyBudgetUsd > 0 ? `$${quota.monthlyBudgetUsd.toFixed(2)}` : "Ilimitado"}
            </span>
          </div>
        </div>

        {quota.monthlyBudgetUsd > 0 && (
          <div className="w-full bg-surface-2 rounded-full h-3 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${isExceeded ? "bg-red-500" : percent >= 80 ? "bg-amber-500" : "bg-primary"}`}
              style={{ width: `${Math.min(100, percent)}%` }}
            />
          </div>
        )}

        {isExceeded && (
          <div className="flex items-center gap-2 text-xs font-medium text-red-500 bg-red-500/10 px-3 py-2 rounded-lg">
            <span className="material-symbols-outlined text-[18px]">warning</span>
            Cota mensal atingida. Novas requisições serão pausadas (HTTP 429) até o próximo ciclo ou expansão de limite.
          </div>
        )}
      </div>

      {/* Seção de Chaves de API */}
      <div className="rounded-xl border border-border-subtle bg-surface p-6 space-y-4">
        <h3 className="text-lg font-bold text-text-main flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-[22px]">vpn_key</span>
          Minhas API Keys
        </h3>
        <p className="text-xs text-text-muted">
          Utilize essas chaves no cabeçalho <code className="bg-surface-2 px-1.5 py-0.5 rounded text-primary">Authorization: Bearer sk-...</code> para consumir a API.
        </p>

        <form onSubmit={handleCreateKey} className="flex flex-col sm:flex-row gap-2 max-w-lg">
          <input
            type="text"
            required
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder="Nome da chave (ex: Backend Produção)"
            className="flex-1 rounded-lg border border-border-subtle bg-surface-2 px-3 py-2 text-sm text-text-main focus:outline-none focus:border-primary min-h-[44px]"
          />
          <Button type="submit" disabled={isCreatingKey} variant="primary" className="min-h-[44px] px-4 font-medium">
            Gerar Chave
          </Button>
        </form>

        <div className="space-y-2 pt-2">
          {keys.length === 0 ? (
            <p className="text-xs text-text-muted italic">Nenhuma chave de API gerada ainda.</p>
          ) : (
            keys.map((k) => (
              <div
                key={k.id}
                className="flex items-center justify-between p-3 rounded-lg border border-border-subtle bg-surface-2 gap-4"
              >
                <div>
                  <h4 className="text-sm font-semibold text-text-main">{k.name}</h4>
                  <p className="text-xs font-mono text-text-muted">{k.key}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => copy(k.key)}
                    variant="ghost"
                    className="text-xs py-1 px-2.5 flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-[16px]">content_copy</span>
                    {copied ? "Copiado!" : "Copiar"}
                  </Button>
                  <Button
                    onClick={() => handleRevokeKey(k.id)}
                    variant="ghost"
                    className="text-xs py-1 px-2.5 text-red-500 hover:text-red-600"
                  >
                    Revogar
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modelos e Combos Disponíveis */}
      <div className="rounded-xl border border-border-subtle bg-surface p-6 space-y-4">
        <h3 className="text-lg font-bold text-text-main flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-[22px]">smart_toy</span>
          Modelos Autorizados
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-lg border border-border-subtle bg-surface-2 space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted">Modelos Diretos</h4>
            {data?.allowedModels?.length > 0 ? (
              <ul className="text-sm space-y-1">
                {data.allowedModels.map((m) => (
                  <li key={m} className="font-mono text-xs text-text-main flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    {m}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-text-muted italic">Todos os modelos padrões disponíveis ou via combos.</p>
            )}
          </div>

          <div className="p-4 rounded-lg border border-border-subtle bg-surface-2 space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted">Combos de Fallback</h4>
            {data?.allowedCombos?.length > 0 ? (
              <ul className="text-sm space-y-1">
                {data.allowedCombos.map((c) => (
                  <li key={c.id} className="text-xs text-text-main flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                    <strong>{c.name}</strong> ({c.models?.length || 0} modelos)
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-text-muted italic">Nenhum combo específico atribuído.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
