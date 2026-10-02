import Link from "next/link";
import { AthleteSpace } from "@/components/athlete-space";

type View = "athlete" | "coach" | "admin";

const navigation = [
  { href: "/app", label: "Mi espacio", view: "athlete" },
  { href: "/coach", label: "Coach", view: "coach" },
  { href: "/admin", label: "Administración", view: "admin" },
];

function Brand() {
  return <Link className="brand" href="/app"><span className="axis-mark" aria-hidden="true" /><span>AKSIS</span></Link>;
}

function AthleteHome() {
  return <>
    <section className="welcome"><p className="eyebrow">Tu espacio</p><h1>Hola, Alex.</h1><p>Un momento para observar cómo estás llegando a tu proceso deportivo.</p></section>
    <section className="session-card"><div><p className="eyebrow">Check-in</p><h2>¿Cómo llegás hoy?</h2><p>Podés empezar por tu entrenamiento, una emoción o algo que te esté dando vueltas.</p></div><Link className="primary-button" href="/lab">Comenzar sesión <span>→</span></Link></section>
    <div className="content-grid">
      <section className="panel"><div className="panel-heading"><div><p className="eyebrow">Último compromiso</p><h2>Volver a tu respiración</h2></div><span className="status-chip">En curso</span></div><p>Antes de tu próximo entrenamiento, registrá qué cambia en tu ritmo cuando prestás atención a la respiración.</p><button className="text-button">Marcar como revisado</button></section>
      <section className="panel journal-panel"><div><p className="eyebrow">Bitácora</p><h2>Dejá una nota para vos</h2><p>Una reflexión después de entrenar también construye contexto para tu proceso.</p></div><button className="secondary-button">Escribir en mi bitácora</button></section>
    </div>
  </>;
}

function CoachHome() {
  const athletes = [["Lucía Martínez", "Atletismo · 400 m vallas", "Gestión de la presión", "Pendiente"], ["Mateo Ruiz", "Ciclismo · Ruta", "Confianza en competencia", "Pendiente"], ["Sofía Herrera", "Natación · Estilo libre", "Equilibrio y descanso", "Atención"]];
  return <><section className="welcome"><p className="eyebrow">Portal de coach</p><h1>Revisiones pendientes</h1><p>Conversaciones y contextos que requieren tu mirada.</p></section><section className="list-panel">{athletes.map(([name, sport, topic, status]) => <article className="athlete-row" key={name}><span className="avatar">{name.charAt(0)}</span><div><h2>{name}</h2><p>{sport}</p><small>Tema: {topic}</small></div><span className={`status-chip ${status === "Atención" ? "attention" : ""}`}>{status}</span><button className="icon-button" aria-label={`Ver a ${name}`}>→</button></article>)}</section></>;
}

function AdminHome() {
  return <><section className="welcome"><p className="eyebrow">Superadministración</p><h1>Panorama de Aksis</h1><p>Uso, suscripciones y salud operativa de la plataforma.</p></section><section className="metric-grid"><article className="metric"><p>Atletas activos</p><strong>0</strong><span>Se conectará a Supabase</span></article><article className="metric"><p>Sesiones este mes</p><strong>0</strong><span>Tiempo y sesiones por usuario</span></article><article className="metric accent"><p>Tokens consumidos</p><strong>0</strong><span>Entrada, salida y costo estimado</span></article></section><section className="panel"><p className="eyebrow">Próximo módulo</p><h2>Telemetría de consumo</h2><p>El esquema ya registra proveedor, modelo, tokens de entrada y salida, latencia y costo por turno. Esta pantalla los mostrará por atleta, período y plan.</p></section></>;
}

export function AppShell({ view }: { view: View }) {
  if (view === "athlete") return <AthleteSpace />;
  const content = view === "coach" ? <CoachHome /> : <AdminHome />;
  return <main className="app-frame"><aside className="sidebar"><Brand /><nav>{navigation.map((item) => <Link className={item.view === view ? "active" : ""} href={item.href} key={item.href}>{item.label}</Link>)}<Link href="/lab">Laboratorio del agente</Link></nav><div className="sidebar-footer"><span className="avatar">A</span><div><strong>Alex</strong><small>Vista de demostración</small></div></div></aside><div className="mobile-bar"><Brand /><Link href="/lab">Laboratorio</Link></div><section className="app-content">{content}</section></main>;
}
