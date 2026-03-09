import { Heart, Twitter, Instagram, Linkedin } from 'lucide-react';

const TikTokIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.77a4.85 4.85 0 0 1-1.01-.08z" />
  </svg>
);

const socialLinks = [
  {
    label: 'X / Twitter',
    href: 'https://x.com/jcastaneda06',
    icon: Twitter,
    color: 'hover:text-sky-400 hover:border-sky-400/40 hover:bg-sky-400/10',
  },
  {
    label: 'Instagram',
    href: 'https://www.instagram.com/gsus6_/',
    icon: Instagram,
    color: 'hover:text-pink-400 hover:border-pink-400/40 hover:bg-pink-400/10',
  },
  {
    label: 'LinkedIn',
    href: 'https://www.linkedin.com/in/jcastaneda06/',
    icon: Linkedin,
    color: 'hover:text-blue-400 hover:border-blue-400/40 hover:bg-blue-400/10',
  },
  {
    label: 'TikTok',
    href: 'https://www.tiktok.com/@yisus.opina',
    icon: TikTokIcon,
    color: 'hover:text-purple-400 hover:border-purple-400/40 hover:bg-purple-400/10',
  },
];

export function Apoyanos() {
  return (
    <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/30 mb-2">
          <Heart className="w-7 h-7 text-red-400" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Apóyanos</h1>
        <p className="text-gray-400 text-base leading-relaxed">
          Mantener este proyecto vivo y transparente.
        </p>
      </div>

      {/* About the project */}
      <section className="px-4 py-4 sm:bg-dark-800 sm:border sm:border-dark-600 sm:rounded-xl sm:p-6 space-y-4">
        <h2 className="text-lg font-semibold text-white">¿Qué es PTY Corrupción?</h2>
        <p className="text-gray-300 text-sm leading-relaxed">
          <strong className="text-white">PTY Corrupción</strong> es un panel de monitoreo de
          corrupción en Panamá. Recopila, analiza y visualiza casos de corrupción, abuso de poder y
          malversación de fondos públicos reportados en medios de comunicación panameños, todo de
          forma automatizada y gratuita.
        </p>
        <p className="text-gray-300 text-sm leading-relaxed">
          El sistema escanea fuentes de noticias diariamente, extrae información estructurada usando
          inteligencia artificial y construye una base de datos pública con casos, personas
          involucradas y montos comprometidos — para que cualquier ciudadano pueda acceder a esta
          información de forma clara y organizada.
        </p>
      </section>

      {/* Motivation */}
      <section className="px-4 py-4 sm:bg-dark-800 sm:border sm:border-dark-600 sm:rounded-xl sm:p-6 space-y-4">
        <h2 className="text-lg font-semibold text-white">¿Por qué lo hice?</h2>
        <p className="text-gray-300 text-sm leading-relaxed">
          Soy un desarrollador panameño frustrado con la impunidad y la falta de herramientas
          ciudadanas para dar seguimiento a los casos de corrupción. La información existe, pero está
          dispersa en cientos de artículos de prensa. Este proyecto nació de la convicción de que la
          tecnología puede —y debe— ponerse al servicio de la transparencia.
        </p>
        <p className="text-gray-300 text-sm leading-relaxed">
          No tiene fines de lucro. Lo construí en mi tiempo libre y lo mantengo por cuenta propia.
          Cualquier apoyo ayuda a pagar los servidores y a seguir mejorando la plataforma.
        </p>
      </section>

      {/* Donate */}
      <section className="text-center space-y-4">
        <h2 className="text-lg font-semibold text-white">Apoya el proyecto</h2>
        <p className="text-gray-400 text-sm">
          Si este proyecto te parece útil, considera hacer una donación. Cada contribución ayuda a
          mantener los servidores activos y el análisis corriendo.
        </p>
        <a
          href="https://www.buymeacoffee.com/jcs98126d"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block"
        >
          <img
            src="https://img.buymeacoffee.com/button-api/?text=Donar&emoji=🙏&slug=jcs98126d&button_colour=ef4444&font_colour=ffffff&font_family=Inter&outline_colour=000000&coffee_colour=FFDD00"
            alt="Donar"
            className="h-12 rounded-lg"
          />
        </a>
      </section>

      {/* Social links */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-white text-center">Sígueme en redes</h2>
        <div className="grid grid-cols-2 gap-3">
          {socialLinks.map(({ label, href, icon: Icon, color }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border border-dark-600 bg-dark-800 text-gray-400 text-sm font-medium transition-all ${color}`}
            >
              <Icon />
              {label}
            </a>
          ))}
        </div>
      </section>
    </main>
  );
}
