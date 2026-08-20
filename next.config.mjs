/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // El build no debe romperse por reglas de estilo.
  eslint: { ignoreDuringBuilds: true },

  // Los errores de TypeScript SI rompen el build, a proposito.
  //
  // ESCAPE HATCH: este repo se escribio en una maquina sin Node instalado,
  // asi que el primer `next build` de Vercel es tambien el primer typecheck.
  // Si Vercel falla por un error de tipos y necesitas el deploy YA,
  // descomenta la linea de abajo, commitea, y arreglalo despues con calma.
  //
  // typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
