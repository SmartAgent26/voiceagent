import React, { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { AlertTriangle, Check, Code, Play, RefreshCw, Trash2, X } from 'lucide-react';

export default function PythonApprovals({ user, onClose }) {
  const [executions, setExecutions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [runningId, setRunningId] = useState(null);

  useEffect(() => {
    if (!user) return;
    loadExecutions();
    
    // Suscribirse a cambios en tiempo real
    const channel = supabase
      .channel('python_execs_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'python_executions', filter: `user_id=eq.${user.id}` }, () => {
        loadExecutions();
      })
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const loadExecutions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .table('python_executions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (data) setExecutions(data);
    } catch (e) {
      console.error("Error al cargar ejecuciones de Python:", e);
    } finally {
      setLoading(false);
    }
  };

  // 1. Aprobar y Gatillar Ejecución en el Sandbox
  const handleApprove = async (id) => {
    setRunningId(id);
    try {
      // a. Actualizar estado a 'approved' en Supabase
      const { error } = await supabase
        .table('python_executions')
        .update({ status: 'approved' })
        .eq('id', id);
        
      if (error) throw error;
      
      // b. Convocar al backend FastAPI para que ejecute el sandbox seguro
      const response = await fetch(`http://localhost:8000/sandbox/execute/${id}`, {
        method: 'POST'
      });
      const data = await response.json();
      
      console.log("Resultado de sandbox:", data);
    } catch (e) {
      console.error("Error en flujo de aprobación y sandbox:", e);
      alert(`Error al ejecutar script: ${e.message}`);
    } finally {
      setRunningId(null);
      loadExecutions();
    }
  };

  // 2. Rechazar Ejecución
  const handleReject = async (id) => {
    try {
      await supabase
        .table('python_executions')
        .update({ status: 'rejected' })
        .eq('id', id);
      loadExecutions();
    } catch (e) {
      console.error("Error al rechazar ejecución:", e);
    }
  };

  // 3. Eliminar Registro del Historial
  const handleDelete = async (id) => {
    try {
      await supabase.table('python_executions').delete().eq('id', id);
      loadExecutions();
    } catch (e) {
      console.error("Error al borrar registro:", e);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="glass-panel w-full max-w-3xl bg-slate-900/90 border border-white/5 rounded-2xl flex flex-col p-6 shadow-2xl">
        {/* Cabecera */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
          <div className="flex items-center gap-3">
            <Code className="w-6 h-6 text-pink-400" />
            <h2 className="text-xl font-semibold text-white">Consola de Seguridad de Código Python</h2>
          </div>
          <div className="flex items-center gap-2">
            <button className="icon hover:bg-white/10 w-9 h-9" onClick={loadExecutions} disabled={loading}>
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button className="icon hover:bg-white/10 w-9 h-9" onClick={onClose}>
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Advertencia de Seguridad */}
        <div className="flex gap-3 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl mb-6 text-sm text-yellow-300">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <div className="flex flex-col gap-1">
            <span className="font-semibold">Política de Aprobación Activa</span>
            <span>
              Por tu seguridad, ningún script de Python escrito por el Voice Agent se ejecuta automáticamente. 
              Por favor, revisa el código fuente y su propósito a continuación antes de dar clic en "Aprobar".
            </span>
          </div>
        </div>

        {/* Lista de Scripts */}
        <div className="flex-1 flex flex-col gap-6 max-h-[50vh] overflow-y-auto pr-2">
          {executions.length === 0 ? (
            <div className="text-center py-10 text-slate-500">
              No hay solicitudes de ejecución de código registradas.
            </div>
          ) : (
            executions.map((exec) => (
              <div 
                key={exec.id} 
                className="flex flex-col gap-3 p-4 rounded-xl bg-slate-800/30 border border-white/5 relative hover:border-white/10 transition-all"
              >
                {/* Info superior */}
                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wide">
                      Propósito: {exec.purpose}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Fecha: {new Date(exec.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium uppercase
                      ${exec.status === 'pending_approval' ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/20' : ''}
                      ${exec.status === 'approved' || exec.status === 'running' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/20 animate-pulse' : ''}
                      ${exec.status === 'executed' ? 'bg-green-500/20 text-green-300 border border-green-500/20' : ''}
                      ${exec.status === 'failed' ? 'bg-red-500/20 text-red-300 border border-red-500/20' : ''}
                      ${exec.status === 'rejected' ? 'bg-slate-700/40 text-slate-400 border border-white/5' : ''}
                    `}>
                      {exec.status === 'pending_approval' ? 'Pendiente' : exec.status === 'running' ? 'Corriendo' : exec.status === 'executed' ? 'Completado' : exec.status === 'failed' ? 'Fallido' : exec.status === 'rejected' ? 'Rechazado' : exec.status}
                    </span>
                    <button className="icon w-8 h-8 hover:bg-red-500/10 hover:text-red-400 border-none" onClick={() => handleDelete(exec.id)}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Bloque de Código */}
                <div className="bg-slate-950 p-3 rounded-lg border border-white/5 font-mono text-xs overflow-x-auto text-pink-300 max-h-36">
                  <pre>{exec.script_code}</pre>
                </div>

                {/* Acciones para Pendientes */}
                {exec.status === 'pending_approval' && (
                  <div className="flex items-center gap-3 mt-1">
                    <button 
                      className="primary py-2 px-4 text-xs font-semibold"
                      onClick={() => handleApprove(exec.id)}
                      disabled={runningId === exec.id}
                    >
                      <Play className="w-3.5 h-3.5" />
                      {runningId === exec.id ? 'Corriendo...' : 'Aprobar & Ejecutar'}
                    </button>
                    <button 
                      className="secondary py-2 px-4 text-xs font-semibold"
                      onClick={() => handleReject(exec.id)}
                      disabled={runningId === exec.id}
                    >
                      <X className="w-3.5 h-3.5" />
                      Rechazar Código
                    </button>
                  </div>
                )}

                {/* Output de Consola */}
                {exec.result_output && (
                  <div className="mt-2 flex flex-col gap-1">
                    <span className="text-[10px] font-semibold text-slate-500 uppercase">Salida de la Consola del Sandbox</span>
                    <div className="bg-slate-900 p-3 rounded-lg border border-white/5 font-mono text-[11px] overflow-x-auto text-slate-300 max-h-40">
                      <pre>{exec.result_output}</pre>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
