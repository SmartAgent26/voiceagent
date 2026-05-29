import React, { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import { Save, Settings, ToggleLeft, ToggleRight, X } from 'lucide-react';

export default function SettingsPanel({ user, onClose }) {
  const [profile, setProfile] = useState({
    name: 'Jarvis',
    avatar_url: '',
    voice_id: 'es-ES-Polyglot-1',
    personality: 'profesional, servicial y altamente eficiente',
    gender: 'neutro',
    age: 30,
    location: 'Buenos Aires, Argentina'
  });
  
  const [skills, setSkills] = useState([
    { name: 'calendar', label: 'Google Calendar API', enabled: true },
    { name: 'drive', label: 'Google Drive Cloud Storage', enabled: true },
    { name: 'slack', label: 'Slack Webhook Alerts', enabled: true },
    { name: 'telegram', label: 'Telegram Bot API', enabled: true },
    { name: 'python', label: 'Python Code Sandbox', enabled: true },
  ]);

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  // 1. Cargar Perfil e Habilidades al montar
  useEffect(() => {
    if (!user) return;
    loadProfile();
    loadSkills();
  }, [user]);

  const loadProfile = async () => {
    try {
      const { data, error } = await supabase
        .table('agent_profile')
        .select('*')
        .eq('user_id', user.id)
        .maybe_single();
      
      if (data) {
        setProfile(data);
      }
    } catch (e) {
      console.error("Error al cargar perfil del agente:", e);
    }
  };

  const loadSkills = async () => {
    try {
      const { data, error } = await supabase
        .table('agent_skills')
        .select('*')
        .eq('user_id', user.id);
      
      if (data && data.length > 0) {
        const updatedSkills = skills.map(skill => {
          const dbSkill = data.find(d => d.skill_name === skill.name);
          return {
            ...skill,
            enabled: dbSkill ? dbSkill.is_enabled : true
          };
        });
        setSkills(updatedSkills);
      }
    } catch (e) {
      console.error("Error al cargar skills del agente:", e);
    }
  };

  // 2. Guardar Perfil del Agente
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMsg('');
    try {
      const payload = {
        user_id: user.id,
        ...profile,
        updated_at: new Date().toISOString()
      };
      
      const { error } = await supabase.table('agent_profile').upsert(payload);
      if (error) throw error;
      setMsg('¡Perfil del agente guardado con éxito!');
    } catch (e) {
      setMsg(`Error al guardar: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 3. Modificar Estado del Skill (Toggle Switch)
  const handleToggleSkill = async (index) => {
    const targetSkill = skills[index];
    const newStatus = !targetSkill.enabled;
    
    // Optimistic Update local
    const updated = [...skills];
    updated[index].enabled = newStatus;
    setSkills(updated);

    try {
      const payload = {
        user_id: user.id,
        skill_name: targetSkill.name,
        is_enabled: newStatus,
        updated_at: new Date().toISOString()
      };
      await supabase.table('agent_skills').upsert(payload);
    } catch (e) {
      console.error("Error al actualizar skill en Supabase:", e);
      // Revertir si falla
      const reverted = [...skills];
      reverted[index].enabled = !newStatus;
      setSkills(reverted);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="glass-panel w-full max-w-2xl bg-slate-900/90 border border-white/5 rounded-2xl flex flex-col p-6 shadow-2xl">
        {/* Cabecera */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
          <div className="flex items-center gap-3">
            <Settings className="w-6 h-6 text-indigo-400" />
            <h2 className="text-xl font-semibold text-white">Configuración del Agente</h2>
          </div>
          <button className="icon hover:bg-white/10" onClick={onClose}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Notificaciones */}
        {msg && (
          <div className={`p-3 rounded-lg mb-4 text-sm font-medium ${msg.includes('Error') ? 'bg-red-500/20 text-red-300' : 'bg-green-500/20 text-green-300'}`}>
            {msg}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Columna Izquierda: Formulario Perfil */}
          <form onSubmit={handleSaveProfile} className="flex flex-col gap-4">
            <h3 className="text-sm font-semibold tracking-wider text-indigo-400 uppercase">Identidad & Personalidad</h3>
            
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-400">Nombre del Agente</label>
              <input 
                type="text" 
                value={profile.name} 
                onChange={e => setProfile({...profile, name: e.target.value})} 
                required 
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-slate-400">Edad</label>
                <input 
                  type="number" 
                  value={profile.age} 
                  onChange={e => setProfile({...profile, age: parseInt(e.target.value) || 0})} 
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-slate-400">Género</label>
                <select 
                  value={profile.gender} 
                  onChange={e => setProfile({...profile, gender: e.target.value})}
                >
                  <option value="masculino">Masculino</option>
                  <option value="femenino">Femenino</option>
                  <option value="neutro">Neutro / No binario</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-400">Ubicación Actual</label>
              <input 
                type="text" 
                value={profile.location} 
                onChange={e => setProfile({...profile, location: e.target.value})} 
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-400">Voz del Sintetizador</label>
              <select 
                value={profile.voice_id} 
                onChange={e => setProfile({...profile, voice_id: e.target.value})}
              >
                <option value="es-ES-Polyglot-1">Google Polyglot (Español Multilingüe)</option>
                <option value="es-ES-Standard-A">Google Standard A (Femenina estándar)</option>
                <option value="es-ES-Standard-B">Google Standard B (Masculina estándar)</option>
                <option value="es-US-Standard-C">Google US Español (Español Neutro)</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-400">Personalidad & Reglas</label>
              <textarea 
                value={profile.personality} 
                onChange={e => setProfile({...profile, personality: e.target.value})}
                rows={3}
                required
              />
            </div>

            <button type="submit" className="primary w-full mt-2" disabled={loading}>
              <Save className="w-4 h-4" />
              {loading ? 'Guardando...' : 'Guardar Ajustes'}
            </button>
          </form>

          {/* Columna Derecha: Toggles Habilidades */}
          <div className="flex flex-col gap-4 border-l border-white/5 pl-0 md:pl-6">
            <h3 className="text-sm font-semibold tracking-wider text-indigo-400 uppercase">Habilitación de Skills</h3>
            <p className="text-xs text-slate-500 mb-2">
              Activa o desactiva qué herramientas de automatización tiene permitido usar el subagente de skills en runtime.
            </p>
            
            <div className="flex flex-col gap-4">
              {skills.map((skill, index) => (
                <div 
                  key={skill.name} 
                  className="flex items-center justify-between p-3 rounded-xl bg-slate-800/40 border border-white/5 hover:border-white/10 transition-all"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium text-white">{skill.label}</span>
                    <span className="text-xs text-slate-500">Intent prefix: skills/{skill.name}.md</span>
                  </div>
                  <button 
                    onClick={() => handleToggleSkill(index)} 
                    className="p-1 rounded-lg hover:bg-white/5 bg-transparent"
                    style={{ border: 'none', background: 'transparent' }}
                  >
                    {skill.enabled ? (
                      <ToggleRight className="w-9 h-9 text-indigo-400 cursor-pointer" />
                    ) : (
                      <ToggleLeft className="w-9 h-9 text-slate-600 cursor-pointer" />
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
