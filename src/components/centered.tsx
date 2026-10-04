"use client";

import Link from "next/link";

export function Centered() {
  return <main className="centered-page"><header><Link href="/app">← Volver a Mi Espacio</Link><span>✦ CENTRADO</span><h1>Un espacio para volver a vos</h1><p>Prácticas breves para preparar tu cuerpo, tu emoción y tu presencia antes de seguir.</p></header><section className="centered-practices"><Link href="/centered/breathing" className="centered-practice breathing-practice"><span className="centered-icon">◌</span><div><small>PRÁCTICA SOMÁTICA</small><h2>Respiración consciente</h2><p>Un ciclo guiado para recuperar calma, claridad y disponibilidad corporal.</p><b>Comenzar práctica →</b></div></Link><article className="centered-practice coming-practice"><span className="centered-icon">⌁</span><div><small>PRÓXIMAMENTE</small><h2>Chequeo de presencia</h2><p>Una pausa breve para observar emoción, cuerpo y foco antes de entrenar o competir.</p><b>En preparación</b></div></article></section><aside className="centered-quote">“La respiración abre el espacio para elegir desde qué observador querés actuar.”<small>AXIOMA SOMÁTICO · AKSIS</small></aside></main>;
}
