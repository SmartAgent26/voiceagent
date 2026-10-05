"use client";

import { FormEvent, useEffect, useState } from "react";
import { useAksisToast } from "@/components/aksis-toast";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

type Plan = { id: string; name: string; monthly_blocks: number; price_ars: number | null; active: boolean };

export default function Plans() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [creating, setCreating] = useState(false);
  const client = createBrowserSupabaseClient();
  const { showToast } = useAksisToast();

  async function operate(body: unknown) {
    const { data } = await client.auth.getSession();
    const response = await fetch("/api/admin/operations", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token || ""}` }, body: JSON.stringify(body) });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "No pudimos completar la operación.");
  }

  async function load() {
    const { data, error } = await client.from("subscription_plans").select("id,name,monthly_blocks,price_ars,active").order("created_at");
    if (error) showToast("No pudimos cargar los planes. Intentá nuevamente.", "error");
    else setPlans((data || []) as Plan[]);
  }
  useEffect(() => { void load(); }, []);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = new FormData(event.currentTarget);
    try { await operate({ action: "plan.create", data: { name: String(value.get("name") || "").trim(), monthlyBlocks: Number(value.get("blocks")), priceArs: value.get("price") === "" ? null : Number(value.get("price")) } }); } catch (error) { return showToast(error instanceof Error ? error.message : "No pudimos crear el plan.", "error"); }
    setCreating(false); showToast("Plan creado correctamente.", "success"); void load();
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!editing) return;
    const value = new FormData(event.currentTarget);
    try { await operate({ action: "plan.update", id: editing.id, data: { name: String(value.get("name") || "").trim(), monthlyBlocks: Number(value.get("blocks")), priceArs: value.get("price") === "" ? null : Number(value.get("price")), active: String(value.get("active")) === "true" } }); } catch (error) { return showToast(error instanceof Error ? error.message : "No pudimos actualizar el plan.", "error"); }
    setEditing(null); showToast("Plan actualizado correctamente.", "success"); void load();
  }

  async function cancel(plan: Plan) {
    try { await operate({ action: "plan.cancel", id: plan.id }); } catch (error) { return showToast(error instanceof Error ? error.message : "No pudimos cancelar el plan.", "error"); }
    setEditing(null); showToast("El plan quedó cancelado; su historial se conserva.", "info"); void load();
  }

  async function remove(plan: Plan) {
    try { await operate({ action: "plan.delete", id: plan.id }); } catch (error) { return showToast(error instanceof Error ? error.message : "No pudimos eliminar el plan.", "error"); }
    setEditing(null); showToast("Plan eliminado definitivamente.", "success"); void load();
  }

  return <main className="admin-view plans-view"><span>ADMINISTRACIÓN · PLANES</span><div className="plans-title-row"><div><h1>Planes y precios</h1><p>Configurá los bloques mensuales y precios de cada suscripción.</p></div><button className="admin-primary-action" onClick={() => setCreating(true)}>＋ Nuevo plan</button></div><section className="plan-grid">{plans.map((plan) => <button className="plan-card" key={plan.id} onClick={() => setEditing(plan)}><div><small className={plan.active ? "is-active" : "is-paused"}>{plan.active ? "ACTIVO" : "CANCELADO"}</small><span>Editar →</span></div><h2>{plan.name}</h2><p><b>{plan.monthly_blocks}</b> bloques mensuales</p><p>{plan.price_ars == null ? "Precio a definir" : `$ ${plan.price_ars.toLocaleString("es-AR")} ARS`}</p></button>)}</section>{!plans.length && <p className="admin-empty">Todavía no hay planes creados.</p>}{creating && <PlanModal title="Nuevo plan" submit="Crear plan" onClose={() => setCreating(false)} onSubmit={create} />}{editing && <PlanModal title={editing.name} submit="Guardar cambios" plan={editing} onClose={() => setEditing(null)} onSubmit={save} onCancel={() => void cancel(editing)} onDelete={() => void remove(editing)} />}</main>;
}

function PlanModal({ title, plan, submit, onClose, onSubmit, onCancel, onDelete }: { title: string; plan?: Plan; submit: string; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; onCancel?: () => void; onDelete?: () => void }) {
  return <div className="admin-plan-modal" role="dialog" aria-modal="true"><form onSubmit={onSubmit}><header><div><span>CONFIGURACIÓN DE SUSCRIPCIÓN</span><h2>{title}</h2></div><button type="button" onClick={onClose} aria-label="Cerrar">×</button></header><label>Nombre del plan<input name="name" defaultValue={plan?.name || ""} required /></label><label>Bloques mensuales<input name="blocks" type="number" min="0" defaultValue={plan?.monthly_blocks ?? ""} required /></label><label>Precio mensual (ARS)<input name="price" type="number" min="0" defaultValue={plan?.price_ars ?? ""} /></label>{plan && <label>Estado<select name="active" defaultValue={String(plan.active)}><option value="true">Activo</option><option value="false">Cancelado</option></select></label>}<footer>{onDelete && <button className="plan-delete" type="button" onClick={onDelete}>Eliminar</button>}{onCancel && plan?.active && <button className="plan-cancel" type="button" onClick={onCancel}>Cancelar plan</button>}<button type="button" onClick={onClose}>Volver</button><button type="submit">{submit}</button></footer></form></div>;
}
