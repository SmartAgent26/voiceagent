import React, { useEffect, useState, useRef } from 'react';
import { supabase } from './supabase';
import { 
  Bot, LogOut, Send, Mic, MicOff, Settings, Code, Plus, MessageSquare, 
  User, Shield, Calendar, CheckSquare, FileText, Menu, ChevronLeft, UploadCloud 
} from 'lucide-react';
import AudioVisualizer from './components/AudioVisualizer';
import SettingsPanel from './components/SettingsPanel';
import PythonApprovals from './components/PythonApprovals';

export default function App() {
  // Auth States
  const [session, setSession] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [authMsg, setAuthMsg] = useState('');

  // App Layout States
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activePanel, setActivePanel] = useState(null); // 'settings', 'python', or null
  
  // Chat States
  const [sessions, setSessions] = useState([]); // Histórico de charlas
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loadingChat, setLoadingChat] = useState(false);
  
  // Ingestion State
  const [isIngesting, setIsIngesting] = useState(false);
  const fileInputRef = useRef(null);

  const messagesEndRef = useRef(null);

  // 1. Escuchar estado de autenticación de Supabase
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // 2. Cargar historial de sesiones conversacionales (ChatGPT Style)
  useEffect(() => {
    if (session) {
      loadSessions();
    }
  }, [session]);

  // 3. Cargar mensajes cuando cambia la sesión activa
  useEffect(() => {
    if (activeSessionId) {
      loadMessages(activeSessionId);
    } else {
      setMessages([]);
    }
  }, [activeSessionId]);

  // Auto-scroll al final del chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ==========================================
  // Operaciones de Autenticación
  // ==========================================
  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthMsg('');
    try {
      if (isRegistering) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setAuthMsg('Registro exitoso. Revisa tu correo de confirmación (si está activo) o inicia sesión.');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (error) {
      setAuthMsg(`Error: ${error.message}`);
    }
  };

  const handleSignOut = () => {
    supabase.auth.signOut();
    setActiveSessionId(null);
    setSessions([]);
  };

  // ==========================================
  // Operaciones del Chat (Conversaciones Históricas)
  // ==========================================
  const loadSessions = async () => {
    try {
      const { data, error } = await supabase
        .table('short_term_sessions')
        .select('id, context, updated_at')
        .eq('user_id', session.user.id)
        .order('updated_at', { ascending: false });
      
      if (data) {
        setSessions(data);
        if (data.length > 0 && !activeSessionId) {
          setActiveSessionId(data[0].id); // Cargar la más reciente por defecto
        }
      }
    } catch (e) {
      console.error("Error al cargar sesiones históricas:", e);
    }
  };

  const loadMessages = async (sid) => {
    try {
      const { data, error } = await supabase
        .table('short_term_sessions')
        .select('messages')
        .eq('id', sid)
        .maybe_single();
      
      if (data && data.messages) {
        setMessages(data.messages);
      } else {
        setMessages([]);
      }
    } catch (e) {
      console.error("Error al cargar mensajes de la sesión:", e);
    }
  };

  const handleNewSession = async () => {
    const newSid = crypto.randomUUID();
    try {
      // Crear registro de sesión inicial
      const { error } = await supabase.table('short_term_sessions').insert({
        id: newSid,
        user_id: session.user.id,
        channel: 'web',
        context: {},
        messages: []
      });
      if (error) throw error;
      
      loadSessions();
      setActiveSessionId(newSid);
    } catch (e) {
      console.error("Error al crear nueva sesión:", e);
    }
  };

  // Enviar Mensaje (Texto)
  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!inputText.trim() || !activeSessionId) return;

    const userText = inputText;
    setInputText('');
    setLoadingChat(true);

    // Optimistic update local instantáneo en la pantalla
    const timestamp = new Date().toISOString();
    setMessages(prev => [...prev, { role: 'user', content: userText, timestamp }]);

    try {
      // Llamar al API del Backend FastAPI
      const response = await fetch('http://localhost:8000/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: session.user.id,
          session_id: activeSessionId,
          text: userText
        })
      });
      const data = await response.json();
      
      // Actualizar mensajes e historial
      loadMessages(activeSessionId);
      loadSessions();

      // Simular reproducción por voz si corresponde
      if (data.response_text) {
        setIsPlaying(true);
        setTimeout(() => setIsPlaying(false), 3000); // 3 segundos de feedback visual hablado
      }
    } catch (error) {
      console.error("Error al enviar mensaje:", error);
      // Fallback si no está prendido el backend FastAPI
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `[Simulación Offline]: Recibí tu mensaje '${userText}'. Asegúrate de correr 'python backend/main.py' para activar al Voice Agent real con RAG y sandbox.`, 
        timestamp: new Date().toISOString() 
      }]);
    } finally {
      setLoadingChat(false);
    }
  };

  // Enviar Mensaje (Voz - Micro)
  const handleToggleVoice = () => {
    if (isRecording) {
      // Detener grabación y procesar (Simulado para desarrollo base en frontend)
      setIsRecording(false);
      setInputText('Agendar una reunión sobre el proyecto VAGENT mañana a las 10 am');
      // Producir submit simulado después de un delay
      setTimeout(() => {
        setInputText('');
        // Ejecución manual simulada del envío
        const userText = 'Agendar una reunión sobre el proyecto VAGENT mañana a las 10 am';
        setMessages(prev => [...prev, { role: 'user', content: userText, timestamp: new Date().toISOString() }]);
        setLoadingChat(true);
        
        fetch('http://localhost:8000/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: session.user.id,
            session_id: activeSessionId,
            text: userText
          })
        }).then(res => res.json()).then(data => {
          loadMessages(activeSessionId);
          loadSessions();
          setIsPlaying(true);
          setTimeout(() => setIsPlaying(false), 3000);
        }).catch(() => {
          setMessages(prev => [...prev, { 
            role: 'assistant', 
            content: `[Simulación Offline de Voz]: Procesé tu nota de voz para agendar la reunión sobre el proyecto VAGENT.`, 
            timestamp: new Date().toISOString() 
          }]);
        }).finally(() => setLoadingChat(false));
      }, 500);
    } else {
      // Iniciar grabación de voz
      setIsRecording(true);
    }
  };

  // ==========================================
  // Ingesta de Archivos para la Base Vectorial
  // ==========================================
  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsIngesting(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("user_id", session.user.id);

    try {
      const response = await fetch('http://localhost:8000/ingest', {
        method: 'POST',
        body: formData
      });
      const data = await response.json();
      alert(`¡Archivo '${file.name}' procesado y guardado vectorialmente con éxito! Chunks creados: ${data.chunks}`);
    } catch (err) {
      console.error("Error al subir archivo para RAG:", err);
      alert("Error al procesar el archivo. ¿Verificaste que el servidor FastAPI esté corriendo en localhost:8000?");
    } finally {
      setIsIngesting(false);
    }
  };

  // Si no está logueado: Renders Login Panel
  if (!session) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="glass-panel w-full max-w-md bg-slate-900/90 border border-white/5 p-8 rounded-2xl shadow-2xl flex flex-col items-center">
          <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center mb-4">
            <Bot className="w-9 h-9 text-white animate-pulse" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">ACIZER Personal Voice Agent</h1>
          <p className="text-sm text-slate-500 text-center mb-6">El asistente de automatización y control semántico e inteligente.</p>

          {authMsg && (
            <div className={`p-3 rounded-lg mb-4 w-full text-xs font-medium text-center ${authMsg.includes('Error') ? 'bg-red-500/20 text-red-300' : 'bg-green-500/20 text-green-300'}`}>
              {authMsg}
            </div>
          )}

          <form onSubmit={handleAuth} className="w-full flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-400">Correo Electrónico</label>
              <input 
                type="email" 
                placeholder="nombre@ejemplo.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
            
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-400">Contraseña</label>
              <input 
                type="password" 
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="primary w-full mt-2 py-3 font-semibold text-sm">
              {isRegistering ? 'Crear Cuenta' : 'Iniciar Sesión'}
            </button>
          </form>

          <button 
            className="secondary bg-transparent border-none text-xs text-indigo-400 hover:text-indigo-300 mt-6"
            onClick={() => setIsRegistering(!isRegistering)}
          >
            {isRegistering ? '¿Ya tienes una cuenta? Inicia Sesión' : '¿No tienes cuenta? Regístrate gratis'}
          </button>
        </div>
      </div>
    );
  }

  // Renders Main Dashboard Workspace
  return (
    <div className="flex-1 flex h-screen overflow-hidden text-slate-200">
      
      {/* 1. BARRA LATERAL (Historial de Conversaciones - ChatGPT Style) */}
      <div 
        className={`glass-panel rounded-none border-r border-white/5 bg-slate-950 flex flex-col transition-all duration-300
          ${sidebarOpen ? 'w-64' : 'w-0 overflow-hidden border-none'}`}
      >
        {/* Cabecera Sidebar */}
        <div className="p-4 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-2 text-indigo-400">
            <Bot className="w-5 h-5" />
            <span className="font-semibold text-sm text-white">ACIZER</span>
          </div>
          <button 
            className="icon w-8 h-8 hover:bg-white/5" 
            onClick={() => setSidebarOpen(false)}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        {/* Nueva Conversación */}
        <div className="p-3">
          <button className="secondary w-full justify-start gap-3 py-2.5 bg-white/5 border border-white/5 hover:border-indigo-500/40" onClick={handleNewSession}>
            <Plus className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-semibold">Nueva Conversación</span>
          </button>
        </div>

        {/* Lista de Charlas Históricas */}
        <div className="flex-1 overflow-y-auto px-2 flex flex-col gap-1.5">
          {sessions.map(s => (
            <button 
              key={s.id}
              className={`w-full justify-start py-2.5 px-3 rounded-lg text-left text-xs font-medium border-none flex items-center gap-2.5 transition-all
                ${activeSessionId === s.id 
                  ? 'bg-gradient-to-r from-indigo-500/20 to-purple-500/10 text-white border-l-2 border-indigo-500' 
                  : 'bg-transparent text-slate-400 hover:bg-white/5 hover:text-slate-200'}`}
              onClick={() => setActiveSessionId(s.id)}
            >
              <MessageSquare className="w-3.5 h-3.5 flex-shrink-0 opacity-70" />
              <span className="truncate flex-1">
                {s.context?.title || `Conversación del ${new Date(s.updated_at).toLocaleDateString()}`}
              </span>
            </button>
          ))}
        </div>

        {/* Info del Usuario Logueado (Footer Sidebar) */}
        <div className="p-3 border-t border-white/10 bg-slate-900/50 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-xs font-bold text-indigo-300">
              {session.user.email[0].toUpperCase()}
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-xs font-medium text-white truncate">{session.user.email}</span>
              <span className="text-[9px] text-slate-500">ID Autenticado</span>
            </div>
          </div>
          <button className="secondary py-2 justify-center w-full bg-red-500/10 text-red-400 border-none hover:bg-red-500/20" onClick={handleSignOut}>
            <LogOut className="w-3.5 h-3.5" />
            <span className="text-[10px] font-semibold">Cerrar Sesión</span>
          </button>
        </div>
      </div>

      {/* Botón de expansión flotante si la Sidebar está colapsada */}
      {!sidebarOpen && (
        <button 
          className="icon absolute top-4 left-4 z-40 bg-slate-900/90 border border-white/10 w-9 h-9"
          onClick={() => setSidebarOpen(true)}
        >
          <Menu className="w-4 h-4" />
        </button>
      )}

      {/* 2. ÁREA DE DIÁLOGO PRINCIPAL (Workspace) */}
      <div className="flex-1 flex flex-col bg-slate-950 overflow-hidden relative">
        
        {/* Cabecera del Panel Principal */}
        <header className="h-16 border-b border-white/5 bg-slate-900/40 backdrop-blur-md flex items-center justify-between px-6 z-10 pl-16 md:pl-6">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-white">Consola Activa</span>
            <span className="text-xs bg-indigo-500/20 text-indigo-300 py-0.5 px-2.5 rounded-full font-medium">FastAPI Local</span>
          </div>

          <div className="flex items-center gap-3">
            {/* Botón Ingesta RAG */}
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileUpload} 
              className="hidden" 
              accept=".pdf,.txt,.md,.csv,.docx"
            />
            <button 
              className="secondary py-2 px-3 text-xs bg-white/5 hover:border-indigo-500/40" 
              onClick={handleFileSelect}
              disabled={isIngesting}
            >
              <UploadCloud className={`w-4 h-4 text-indigo-400 ${isIngesting ? 'animate-bounce' : ''}`} />
              <span className="hidden sm:inline">{isIngesting ? 'Indexando...' : 'Subir Archivo RAG'}</span>
            </button>

            {/* Consola de Código Sandbox */}
            <button className="secondary py-2 px-3 text-xs bg-white/5 hover:border-pink-500/40" onClick={() => setActivePanel('python')}>
              <Code className="w-4 h-4 text-pink-400" />
              <span className="hidden sm:inline">Aprobaciones Python</span>
            </button>

            {/* Ajustes Perfil */}
            <button className="icon w-9 h-9 hover:bg-white/10" onClick={() => setActivePanel('settings')}>
              <Settings className="w-4 h-4 text-slate-300" />
            </button>
          </div>
        </header>

        {/* Hilo de Mensajes */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 max-w-4xl mx-auto w-full">
          {messages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
              <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-indigo-500/10 to-purple-500/10 flex items-center justify-center border border-white/5 mb-4">
                <Bot className="w-10 h-10 text-indigo-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-1">¿Cómo puedo ayudarte hoy?</h3>
              <p className="text-sm text-slate-500 max-w-sm">
                Puedes hablarme por voz usando el micrófono o escribir tus comandos de calendario, recordatorios y nube.
              </p>
            </div>
          ) : (
            messages.map((msg, i) => (
              <div 
                key={i} 
                className={`flex gap-4 max-w-[85%] ${msg.role === 'user' ? 'self-end flex-row-reverse' : 'self-start'}`}
              >
                {/* Avatar */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0
                  ${msg.role === 'user' 
                    ? 'bg-indigo-600 text-white' 
                    : 'bg-gradient-to-tr from-indigo-500 to-purple-600 text-white'}`}
                >
                  {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>

                {/* Burbuja */}
                <div className="flex flex-col gap-1">
                  <div className={`p-4 rounded-2xl text-sm leading-relaxed whitespace-pre-line
                    ${msg.role === 'user' 
                      ? 'bg-indigo-600/90 text-white rounded-tr-none' 
                      : 'bg-slate-900/80 border border-white/5 text-slate-200 rounded-tl-none'}`}
                  >
                    {msg.content}
                  </div>
                  <span className={`text-[9px] text-slate-600 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))
          )}
          {loadingChat && (
            <div className="self-start flex gap-4 max-w-[85%]">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-white animate-pulse" />
              </div>
              <div className="p-4 rounded-2xl bg-slate-900/80 border border-white/5 rounded-tl-none flex items-center gap-1.5 h-11 justify-center">
                <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0s' }} />
                <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0.15s' }} />
                <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0.3s' }} />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* 3. ENTRADA DE DIÁLOGO HÍBRIDA (Texto y Voz) */}
        <div className="p-6 bg-gradient-to-t from-slate-950 via-slate-950 to-transparent">
          <div className="max-w-4xl mx-auto flex flex-col items-center gap-4">
            
            {/* Visualizador de Voz flotante si está grabando/reproduciendo */}
            {(isRecording || isPlaying) && (
              <div className="glass-panel w-full bg-slate-900/90 border border-white/10 rounded-2xl p-4 flex flex-col items-center justify-center shadow-xl">
                <AudioVisualizer isRecording={isRecording} isPlaying={isPlaying} />
              </div>
            )}

            {/* Input bar */}
            <form onSubmit={handleSendMessage} className="w-full flex items-center gap-3">
              {/* Botón Micrófono */}
              <button 
                type="button"
                className={`icon w-12 h-12 flex-shrink-0 border-none transition-all
                  ${isRecording 
                    ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/20' 
                    : 'bg-white/5 hover:bg-indigo-500/10 hover:text-indigo-400 text-slate-300'}`}
                onClick={handleToggleVoice}
              >
                {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>

              {/* Entrada de Texto */}
              <input 
                type="text" 
                placeholder={isRecording ? "Escuchando tu nota de voz..." : "Pregúntale algo a tu Voice Agent..."}
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                disabled={isRecording || loadingChat || !activeSessionId}
                className="flex-1 bg-slate-900/60 border border-white/5 py-3.5 px-4 text-white text-sm rounded-xl focus:border-indigo-500/40"
              />

              {/* Botón Enviar */}
              <button 
                type="submit" 
                disabled={isRecording || loadingChat || !inputText.trim() || !activeSessionId}
                className="primary w-12 h-12 rounded-xl flex-shrink-0 p-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* 4. MODALES DE INTEGRACIÓN */}
      {activePanel === 'settings' && (
        <SettingsPanel user={session.user} onClose={() => setActivePanel(null)} />
      )}
      {activePanel === 'python' && (
        <PythonApprovals user={session.user} onClose={() => setActivePanel(null)} />
      )}
    </div>
  );
}
