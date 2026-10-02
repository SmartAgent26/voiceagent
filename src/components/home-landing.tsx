import Image from "next/image";
import Link from "next/link";
import heroImage from "../../Diseño/Pagina de Inicio/screen.png";

export function HomeLanding() {
  return <main className="mindful-home"><div className="home-top"><span>ESPACIO CONSCIENTE</span><button aria-label="Respiración">≋</button></div><div className="home-orbit"><i /><i /><i /><Image src={heroImage} alt="Deportista en pausa consciente antes de entrenar" priority /></div><div className="home-copy"><p className="presence">♧ &nbsp; HABITA EL PRESENTE…</p><h1>AKSIS</h1><h2>COACHING ONTOLÓGICO DEPORTIVO</h2><p>Transforma tu ser, potencia tu juego. El sendero consciente para deportistas en búsqueda de plenitud y maestría.</p></div><div className="home-actions"><Link href="/access?mode=signup" className="home-primary">Comenzar experiencia <b>→</b></Link><Link href="/access" className="home-secondary">Ya soy parte de la comunidad <b>• Iniciar sesión</b></Link></div><div className="home-domains"><span>● &nbsp; CUERPO</span><i /> <span>● &nbsp; LENGUAJE</span><i /> <span>● &nbsp; EMOCIÓN</span></div></main>;
}
